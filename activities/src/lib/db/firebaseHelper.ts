import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app"
import { Database, get, getDatabase, ref, update } from "firebase/database"
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

  // Deliberately no runTransaction() here - firebase/database's client-SDK transaction() needs a
  // listener-warmed local sync cache to know a path's "current" value, which a fresh one-shot Node
  // connection (every call from here) never has, so its callback fires with a false `null` on the
  // first invocation even when the data genuinely exists on the server. Confirmed by direct testing
  // (see blackjackHandler.ts's runLobbyMutation) - it silently rejected every action that used it. A
  // real transaction would need firebase-admin's server-side SDK instead (a service account, not the
  // apiKey config this app uses).
}
