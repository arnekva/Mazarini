import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app"
import { Database, get, getDatabase, ref, runTransaction, update } from "firebase/database"
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

  public updateData(updates: Record<string, unknown>) {
    return update(ref(this.db, database), updates)
  }

  /** Atomic read-modify-write on a single path - the RTDB server serializes concurrent transactions
   * against the same path, retrying `updateFn` against whatever the *current* value actually is each
   * time, instead of two concurrent requests both reading the same stale snapshot and one silently
   * clobbering the other's write. `updateFn` must be synchronous and side-effect-free (it can run
   * more than once per call): do any async work before calling this, and apply any side effects
   * (crediting chips, etc.) only after `committed` comes back true. Return `undefined` from `updateFn`
   * to abort without writing (e.g. to reject an invalid action). */
  public async runTransaction<T = any>(path: string, updateFn: (current: T | null) => T | null | undefined): Promise<{ committed: boolean; value: T | null }> {
    const result = await runTransaction(ref(this.db, `${database}/${path}`), updateFn)
    return { committed: result.committed, value: result.snapshot.val() }
  }
}
