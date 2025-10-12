import { FirebaseApp } from 'firebase/app'
import { Database, child, get, getDatabase, increment, ref, remove, set, update } from 'firebase/database'
import { Firestore, getFirestore } from 'firebase/firestore'
import {
    FirebaseStorage,
    StorageReference,
    UploadMetadata,
    UploadResult,
    getBytes,
    getDownloadURL,
    getStorage,
    ref as storageRef,
    uploadBytes,
} from 'firebase/storage'
import moment from 'moment'
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
        this.messageHelper = messageHelper
        this.storage = getStorage(firebaseApp)
    }

    public async getStorageData(ref: StorageReference): Promise<ArrayBuffer> {
        return await getBytes(ref)
    }

    public async getStorageLink(ref: StorageReference): Promise<string> {
        return await getDownloadURL(ref)
    }

    public getStorageRef(path: string): StorageReference {
        return storageRef(this.storage, path)
    }

    public async uploadToStorage(ref: StorageReference, data: Buffer, meta?: UploadMetadata): Promise<UploadResult> {
        return await uploadBytes(ref, data, meta)
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

    public updateData(updates: object) {
        update(ref(this.db, database), updates)
    }

    public updateUser(user: MazariniUser) {
        const updates = {}
        updates[`/users/${user.id}`] = user
        this.updateData(updates)
    }

    public incrementData(paths: string[], negative?: boolean) {
        const updates = {}
        paths.forEach((path) => {
            const num = paths.filter((x) => x === path).length
            updates[path] = increment(negative ? -num : num)
        })
        this.updateData(updates)
    }

    public async deleteData(path: string) {
        await remove(ref(this.db, `${database}/${path}`))
    }

    public async createBackup() {
        const BACKUP_KEY = 'backup'
        const allCurrentData = (await get(child(ref(this.db), `${database}/`))).val()
        const allBackups = await (await get(child(ref(this.db), `${BACKUP_KEY}/`))).val()
        const backupLength = Object.keys(allBackups || {}).length
        const oldestKey = Object.keys(allBackups || {}).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
        if (oldestKey && backupLength >= 5) {
            await this.deleteData(`${BACKUP_KEY}/${oldestKey}`)
        }
        const dateAsDDMMYYYY = moment().format('DD-MM-YYYY')
        await set(ref(this.db, `${BACKUP_KEY}/${dateAsDDMMYYYY}`), allCurrentData)
    }

    get msgHelper() {
        return this.messageHelper
    }
}
