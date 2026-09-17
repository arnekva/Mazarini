import { FirebaseApp, initializeApp } from "firebase/app"
import { Database, get, getDatabase, ref, update } from "firebase/database"
import { database, firebaseConfig } from "../env"

// Server-only - the same Firebase RTDB project and `users/{id}` shape the bot uses
// (see client-env.ts and helpers/firebaseHelper.ts in the repo root).
export class FirebaseHelper {
  private firebaseApp: FirebaseApp
  private db: Database

  constructor() {
    this.firebaseApp = initializeApp(firebaseConfig)
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
}
