import { FirebaseApp } from 'firebase/app'
import { Database, child, get, getDatabase, ref, remove, set, update } from 'firebase/database'
import { Firestore, getFirestore } from 'firebase/firestore'
import { database } from '../client-env'
import { BotData, DatabaseStructure, MazariniStorage, MazariniUser, Meme } from '../interfaces/database/databaseInterface'
import { MessageHelper } from './messageHelper'

export class FirebaseHelper {
    private firebaseApp: FirebaseApp
    private db: Database
    private firestore: Firestore
    private messageHelper: MessageHelper

    constructor(firebaseApp: FirebaseApp, messageHelper: MessageHelper) {
        this.firebaseApp = firebaseApp
        this.db = getDatabase(firebaseApp)
        this.firestore = getFirestore(firebaseApp)
    }

    public async saveData(data: DatabaseStructure) {
        if (data.bot) await this.saveBotData(data.bot)
        if (data.other) await this.saveMazariniStorage(data.other)
        if (data.users) await this.saveUsers(data.users)
    }

    public async saveUsers(users: MazariniUser[]) {
        await users.forEach((user) => this.saveUser(user))
    }

    public async saveUser(user: MazariniUser) {
        await set(ref(this.db, `${database}/users/${user.id}`), user)
    }

    public async saveBotData(data: BotData) {
        await set(ref(this.db, `${database}/bot`), data)
    }

    public async saveMazariniStorage(data: MazariniStorage) {
        await set(ref(this.db, `${database}/other`), data)
    }

    public async addTextCommands(name: string, data: string) {
        let texts = await this.getTextCommands(name)
        if (texts) texts.push(data)
        else texts = [data]
        set(ref(this.db, `${database}/textCommand/${name}`), texts)
    }

    public async getAllUsers(): Promise<MazariniUser[]> {
        return Object.values(await this.getData(`users`))
    }

    public async getUser(userId: string): Promise<MazariniUser> {
        return (await this.getData(`users/${userId}`)) as MazariniUser
    }

    public async getAllBotData(): Promise<BotData> {
        return (await this.getData(`bot`)) as BotData
    }

    public async getBotData(path: string): Promise<any> {
        return await this.getData(`bot/${path}`)
    }

    public async getMazariniStorage(): Promise<MazariniStorage> {
        return (await this.getData(`other`)) as MazariniStorage
    }

    public async getMemes(): Promise<Meme[]> {
        return (await this.getData(`memes`)) as Meme[]
    }

    public async getTextCommands(name: string): Promise<string[]> {
        return (await this.getData(`textCommand/${name}`)) as string[]
    }

    public async getData(path: string): Promise<any> {
        const response = await get(child(ref(this.db), `${database}/${path}`))
        if (response.exists()) return response.val() as any
        else {
            this.messageHelper?.sendLogMessage(`Prøvde å hente ${path}, men fant ingen data.`)
            return null
        }
    }

    public async updateData(updates: object) {
        update(ref(this.db, database), updates).catch((error) => {
            this.messageHelper.sendLogMessage('Prøvde å oppdatere data, men feilet\n' + error + '\nForsøker å opprette dataen i databasen')
            Object.keys(updates).forEach(async (key) => {
                set(ref(this.db, `${database}${key}`), updates[key])
                    .then(() => {
                        this.messageHelper.sendLogMessage(`La til ${updates[key]} i databasen under ${key}`)
                    })
                    .catch((error) => {
                        this.messageHelper.sendLogMessage(`Klarte ikke å legge til $${updates[key]} i databasen.`)
                    })
            })
        })
    }

    public async updateUser(user: MazariniUser) {
        const updates = {}
        updates[`/users/${user.id}`] = user
        await this.updateData(updates)
    }

    public async deleteData(path: string) {
        await remove(ref(this.db, `${database}/${path}`))
    }
}

function delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time))
}
