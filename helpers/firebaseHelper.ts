import { FirebaseApp } from 'firebase/app'
import { Database, child, get, getDatabase, increment, ref, remove, set, update } from 'firebase/database'
import { FirebaseStorage, getStorage, getStream, StorageReference, ref as storageRef, getBytes, uploadBytes } from "firebase/storage"
import { Firestore, getFirestore } from 'firebase/firestore'
import { database } from '../client-env'
import { BotData, DatabaseStructure, EmojiStats, MazariniStats, MazariniStorage, MazariniUser, Meme } from '../interfaces/database/databaseInterface'
import { MessageHelper } from './messageHelper'

export class FirebaseHelper {
    private firebaseApp: FirebaseApp
    private db: Database
    private firestore: Firestore
    private messageHelper: MessageHelper
    private storage: FirebaseStorage

    constructor(firebaseApp: FirebaseApp, messageHelper: MessageHelper) {
        this.firebaseApp = firebaseApp
        this.db = getDatabase(firebaseApp)
        this.firestore = getFirestore(firebaseApp)
        this.storage = getStorage(firebaseApp)
    }

    public async getStorageData(ref: StorageReference): Promise<ArrayBuffer> {
        return await getBytes(ref)
    }

    public getStorageRef(path: string): StorageReference {
        return storageRef(this.storage, path);
    }

    public uploadToStorage(ref: StorageReference, data: Buffer) {
        uploadBytes(ref, data)
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

    public async getMazariniStats(): Promise<MazariniStats> {
        return (await this.getData(`stats`)) as MazariniStats
    }

    public async getEmojiStats(name: string): Promise<EmojiStats> {
        return (await this.getData(`stats/emojis/${name}`)) as EmojiStats
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
        update(ref(this.db, database), updates)
    }

    public async updateUser(user: MazariniUser) {
        const updates = {}
        updates[`/users/${user.id}`] = user
        await this.updateData(updates)
    }

    public async incrementData(paths: string[], negative?: boolean) {
        const updates = {}
        paths.forEach((path) => {
            const num = paths.filter(x => x === path).length
            updates[path] = increment(negative ? -num : num)
        })
        await this.updateData(updates)
    }

    public async deleteData(path: string) {
        await remove(ref(this.db, `${database}/${path}`))
    }
}

function delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time))
}
