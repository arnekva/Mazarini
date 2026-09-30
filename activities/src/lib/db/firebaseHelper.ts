import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app"
import { Database, get, getDatabase, increment, limitToLast, orderByKey, query, ref, runTransaction, update } from "firebase/database"
import { database, firebaseConfig } from "../env"

// Server-only - the same Firebase RTDB project and `users/{id}` shape the bot uses
// (see client-env.ts and helpers/firebaseHelper.ts in the repo root).
export class FirebaseHelper {
  private firebaseApp: FirebaseApp
  private db: Database

  constructor() {
    // A warm serverless container reuses the same Node process across requests, and every route
    // constructs its own `new FirebaseHelper()` - calling initializeApp() unconditionally here
    // throws "Firebase App named '[DEFAULT]' already exists" on any request after the first one
    // to land on that container. Reuse the existing app instead of re-initializing it.
    this.firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
    this.db = getDatabase(this.firebaseApp)
  }

  public async getData(path: string): Promise<any> {
    const response = await get(ref(this.db, `${database}/${path}`))
    return response.exists() ? response.val() : undefined
  }

  /** The whole user record - it's big (stats, loot, decks). Anything that polls should read just the field it needs instead. */
  public async getUser(userId: string): Promise<any> {
    return this.getData(`users/${userId}`)
  }

  public async getChips(userId: string): Promise<number> {
    return (await this.getData(`users/${userId}/chips`)) ?? 0
  }

  /** The newest `count` children of `path` by key - for lists whose keys sort by time (chat messages). */
  public async getLastChildren(path: string, count: number): Promise<Record<string, any>> {
    const response = await get(query(ref(this.db, `${database}/${path}`), orderByKey(), limitToLast(count)))
    return response.exists() ? response.val() : {}
  }

  /** Shallow-merges `fields` onto users/{userId} - only the given fields change, everything else (including
   * concurrent writes from the bot itself) is left alone. Prefer this over reading+writing the whole user. */
  public updateUserFields(userId: string, fields: Record<string, unknown>) {
    return update(ref(this.db, `${database}/users/${userId}`), fields)
  }

  /** Adds to the deathroll pot. The bot keeps the pot in memory and only writes it to the DB on save/hourly, so a direct
   * write to other/deathrollPot from here gets overwritten by the bot's next save - and the bot never re-reads it. This adds to
   * other/deathrollPotPending instead, with a server-side atomic increment (no read-modify-write, safe against concurrent
   * adds), and the bot drains it into the real pot (see syncPendingPot in commands/games/deathroll.ts). */
  public addToDeathrollPot(amount: number) {
    return update(ref(this.db, database), { "other/deathrollPotPending": increment(amount) })
  }

  /** Claims `path` for whoever asks first - true for exactly one caller, false for everyone after. Used where only one of
   * several concurrent requests may do something (e.g. resolve a roulette spin and pay it out).
   *
   * This is a real transaction, and it does work from a fresh one-shot connection: the callback's first run sees a guessed
   * `null` (the cache is cold), the server rejects the commit if that guess was wrong and re-runs it with the real value.
   * So `null` must mean "not claimed yet" here - treating it as "doesn't exist, abort" is what made an earlier attempt
   * elsewhere look broken. Verified with concurrent claims: exactly one winner. */
  public async claim(path: string, value: unknown = { at: Date.now() }): Promise<boolean> {
    const result = await runTransaction(ref(this.db, `${database}/${path}`), (current) => (current === null ? value : undefined))
    return result.committed
  }

  public updateData(updates: Record<string, unknown>) {
    return update(ref(this.db, database), updates)
  }

  /** Atomic read-modify-write of whatever is at `path`: the server only accepts the write if the value is still the one `apply`
   * was given, and otherwise `apply` runs again on the newer one - so two requests landing together can't overwrite each other.
   * `apply` returns the new value, or undefined to leave things as they are. It can run more than once, so it must not have
   * side effects: do those after this resolves. Resolves to what's at the path afterwards - null if there's nothing there.
   *
   * The first run always sees `null` from here (see claim above) - that's "not known yet", not "missing", so it's answered with
   * `null` without calling `apply`: if there really is nothing, nothing is written; if there is, the server rejects that and the
   * next run gets the real value. Aborting on that first null is what broke the earlier attempt at this. */
  public async transact<T = any>(path: string, apply: (current: T) => T | undefined): Promise<T | null> {
    const result = await runTransaction(ref(this.db, `${database}/${path}`), (current) => (current === null ? null : apply(current)), { applyLocally: false })
    return result.snapshot.val()
  }
}
