import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app"
import { Database, get, getDatabase, increment, ref, runTransaction, update } from "firebase/database"
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

  public async getUser(userId: string): Promise<any> {
    return this.getData(`users/${userId}`)
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

  // Deliberately no runTransaction() here - firebase/database's client-SDK transaction() needs a
  // listener-warmed local sync cache to know a path's "current" value, which a fresh one-shot Node
  // connection (every call from here) never has, so its callback fires with a false `null` on the
  // first invocation even when the data genuinely exists on the server. Confirmed by direct testing
  // (see blackjackHandler.ts's runLobbyMutation) - it silently rejected every action that used it. A
  // real transaction would need firebase-admin's server-side SDK instead (a service account, not the
  // apiKey config this app uses).
}
