import { FirebaseApp } from 'firebase/app'
import {
    child,
    Database,
    DataSnapshot,
    get,
    getDatabase,
    increment,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    onValue,
    ref,
    remove,
    set,
    update,
    Unsubscribe,
} from 'firebase/database'
import {
    FirebaseStorage,
    getBytes,
    getDownloadURL,
    getStorage,
    ref as storageRef,
    StorageReference,
    uploadBytes,
    UploadMetadata,
    UploadResult,
} from 'firebase/storage'
import moment from 'moment'
import { database } from '../client-env'
import { BotData, DatabaseStructure, EmojiStats, MazariniStats, MazariniStorage, MazariniUser, Meme } from '../interfaces/database/databaseInterface'
import { MessageHelper } from './messageHelper'

export class FirebaseHelper {
    private firebaseApp: FirebaseApp
    private db: Database
    private messageHelper: MessageHelper
    private storage: FirebaseStorage

    constructor(firebaseApp: FirebaseApp, messageHelper: MessageHelper) {
        this.firebaseApp = firebaseApp
        this.db = getDatabase(firebaseApp)
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
        await Promise.all(users.map((user) => this.saveUser(user)))
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

    /** Every user record. The id is taken from the record's key when the record itself doesn't have one: the Activities app writes
     * single fields straight to users/{id}, which for someone the bot has never seen leaves a record with nothing else in it. */
    public async getAllUsers(): Promise<MazariniUser[]> {
        const users = ((await this.getData(`users`)) ?? {}) as Record<string, MazariniUser>
        return Object.entries(users).map(([id, user]) => (user.id ? user : { ...user, id }))
    }

    public async getUser(userId: string): Promise<MazariniUser> {
        return (await this.getData(`users/${userId}`)) as MazariniUser
    }

    /**
     * Live-subscribe to a single user's DB record. `callback` fires immediately with the current
     * value, then again on every subsequent change to that path — including writes made by other
     * processes (e.g. the lucky wheel activity), which a one-shot `get()` would never see.
     * Returns an unsubscribe function; the caller is responsible for detaching it when done.
     */
    public subscribeToUser(userId: string, callback: (user: MazariniUser | null) => void): Unsubscribe {
        const userRef = ref(this.db, `${database}/users/${userId}`)
        return onValue(userRef, (snapshot) => {
            callback(snapshot.exists() ? (snapshot.val() as MazariniUser) : null)
        })
    }

    public async getAllBotData(): Promise<BotData> {
        return (await this.getData(`bot`)) as BotData
    }

    public async getBotData(path: string, silent = false): Promise<any> {
        return await this.getData(`bot/${path}`, silent)
    }

    public async getMazariniStorage(): Promise<MazariniStorage> {
        return (await this.getData(`other`)) as MazariniStorage
    }

    /**
     * Live-subscribe to the shared MazariniStorage ("other") node, one top-level entry at a time: `onEntry` is called with each entry's
     * key and value as it's first seen and again whenever it changes (`undefined` when it's removed) - including writes made by other
     * processes - so a cached copy never goes stale the way a one-shot get() would between polls.
     *
     * Per entry rather than the node as a whole, because the Activities app keeps its live game state under the same node: listening to
     * all of it meant rebuilding the entire storage object on every card dealt there. Entries `skip` says yes to are never even unpacked.
     * Returns an unsubscribe function; the caller is responsible for detaching it when done.
     */
    public subscribeToStorage(onEntry: (key: string, value: unknown) => void, skip: (key: string) => boolean): Unsubscribe {
        const otherRef = ref(this.db, `${database}/other`)
        const changed = (snapshot: DataSnapshot) => {
            if (snapshot.key && !skip(snapshot.key)) onEntry(snapshot.key, snapshot.val())
        }
        const stops = [
            onChildAdded(otherRef, changed),
            onChildChanged(otherRef, changed),
            onChildRemoved(otherRef, (snapshot) => {
                if (snapshot.key && !skip(snapshot.key)) onEntry(snapshot.key, undefined)
            }),
        ]
        return () => stops.forEach((stop) => stop())
    }

    /**
     * Live-subscribe to the amount the Activities app has queued up for the deathroll pot (other/deathrollPotPending). `callback`
     * fires once on attach with the current value (0 when the node doesn't exist) and again on every change, so nothing has to poll.
     * Returns an unsubscribe function.
     */
    public subscribeToPendingDeathrollPot(callback: (amount: number) => void): Unsubscribe {
        const pendingRef = ref(this.db, `${database}/other/deathrollPotPending`)
        return onValue(pendingRef, (snapshot) => {
            const amount = snapshot.exists() ? Number(snapshot.val()) : 0
            callback(isNaN(amount) ? 0 : amount)
        })
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

    public async getData(path: string, silent = false): Promise<any> {
        const response = await get(child(ref(this.db), `${database}/${path}`))
        if (response.exists()) return response.val() as any
        else {
            if (!silent) this.messageHelper?.sendLogMessage(`Prøvde å hente ${path}, men fant ingen data.`)
            return null
        }
    }

    public async updateData(updates: object) {
        await update(ref(this.db, database), updates)
    }

    public async updateUser(user: MazariniUser) {
        const updates = {}
        updates[`/users/${user.id}`] = user
        await this.updateData(updates)
    }

    public incrementData(paths: string[], negative?: boolean) {
        const updates = {}
        paths.forEach((path) => {
            const num = paths.filter((x) => x === path).length
            updates[path] = increment(negative ? -num : num)
        })
        this.updateData(updates)
    }

    public async deleteData(path: string, customOrigin?: string) {
        await remove(ref(this.db, `${customOrigin ?? database}/${path}`))
    }

    public async createBackup() {
        const BACKUP_KEY = 'backup'
        const allCurrentData = (await get(child(ref(this.db), `${database}/`))).val()
        const allBackups = (await get(child(ref(this.db), `${BACKUP_KEY}/`))).val()
        const backupLength = Object.keys(allBackups || {}).length
        // The keys are dates as DD-MM-YYYY - which `new Date()` either can't read at all or reads as MM-DD, so they're parsed as what they are.
        const takenAt = (key: string) => moment(key, 'DD-MM-YYYY').valueOf()
        const oldestKey = Object.keys(allBackups || {}).sort((a, b) => takenAt(a) - takenAt(b))[0]
        if (oldestKey && backupLength >= 4) {
            await this.deleteData(`${oldestKey}`, BACKUP_KEY)
        }
        const dateAsDDMMYYYY = moment().format('DD-MM-YYYY')
        await set(ref(this.db, `${BACKUP_KEY}/${dateAsDDMMYYYY}`), allCurrentData)
    }

    get msgHelper() {
        return this.messageHelper
    }
}
