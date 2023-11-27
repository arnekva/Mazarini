//https://openbase.com/js/node-json-db
import moment from 'moment'
import { JsonDB } from 'node-json-db'
import { Config } from 'node-json-db/dist/lib/JsonDBConfig'
import { ChipsStats, MazariniStorage, MazariniUser, Meme, RulettStats, botDataPrefix } from '../interfaces/database/databaseInterface'
import { FirebaseHelper } from './firebaseHelper'

const db = new JsonDB(new Config('myDataBase', true, true, '/'))
const folderPrefix = '/users'
const storagePrefix = '/other'
const botFolder = '/bot'
const textCommandFolder = '/textCommand'

export class DatabaseHelper {
    private db: FirebaseHelper

    constructor(firebaseHelper: FirebaseHelper) {
        this.db = firebaseHelper
    }

    /**
     * Get a user object by ID.
     * @param userID ID of the user as a string
     * @returns
     */
    public async getUser(userID: string): Promise<MazariniUser> {
        let user = await this.db.getUser(userID)       
        if (user) return user
        return await this.addUser(DatabaseHelper.defaultUser(userID))
    }

    public async addUser(user: MazariniUser): Promise<MazariniUser> {
        await this.db.saveUser(user)
        return user
    }

    /** Get an untyped user object. Do not use unless you know what you are doing */
    public async getUntypedUser(userID: string): Promise<any> {
        try {
            return await this.db.getUser(userID) as MazariniUser as any
        } catch (error: any) {
            return undefined
        }
    }

    /** Update the user object in DB */
    public updateUser(user: MazariniUser) {
        this.db.updateUser(user)
    }

    /** Get the cache. Will create and return an empty object if it doesnt exist */
    public async getStorage(): Promise<MazariniStorage> {
        return await this.db.getMazariniStorage()
    }

    /** Directly uppdates the storage with the given props.
     * Note that this will overwrite existing cache. Any data you want to keep must be added to the partial. Use getCache() to get the current cache value */
    public async updateStorage(props: Partial<Omit<MazariniStorage, 'updateTimer'>>) {
        const updates = {}
        for (const prop in props) {
            updates[`/other/${prop}`] = props[prop]
        }
        updates['/other/updateTimer'] = moment(new Date()).unix()
        this.db.updateData(updates)
    }

    /** Update the chips stats property of a user stat object. Will set value of property to 1 if not created yet.
     *  Remember that you will still need to call DatabaseHelper.updateUser() to save the information */
    static incrementChipsStats(userObject: MazariniUser, property: keyof ChipsStats) {
        if (userObject.userStats?.chipsStats) {
            userObject.userStats.chipsStats[property] = ++userObject.userStats.chipsStats[property] || 1
        } else {
            if (userObject.userStats) {
                userObject.userStats.chipsStats = {
                    [property]: 1,
                }
            } else {
                userObject.userStats = {
                    chipsStats: {
                        [property]: 1,
                    },
                }
            }
        }
    }
    /** Update the rulett stats property of a user stat object. Will set value of property to 1 if not created yet.
     *  Remember that you will still need to call DatabaseHelper.updateUser() to save the information */
    static incrementRulettStats(userObject: MazariniUser, property: keyof RulettStats) {
        if (userObject.userStats?.rulettStats) {
            userObject.userStats.rulettStats[property] = ++userObject.userStats.rulettStats[property] || 1
        } else {
            if (userObject.userStats) {
                userObject.userStats.rulettStats = {
                    [property]: 1,
                }
            } else {
                userObject.userStats = {
                    rulettStats: {
                        [property]: 1,
                    },
                }
            }
        }
    }

    public async getBotData(prefix: botDataPrefix) {
        return await this.db.getBotData(prefix)
    }

    public setBotData(prefix: botDataPrefix, value: any) {
        const updates = {}
        updates[`/bot/${prefix}`] = value
        this.db.updateData(updates)
    }

    public setTextCommandValue(commandName: string, value: any) {
        this.db.addTextCommands(commandName, value)
    }
    public nukeTextCommand(commandName: string, index: number) {
        this.db.deleteData(`textCommand/${commandName}/${index}`)
    }
    public async getTextCommandValueArray(commandName: string) {
        return await this.db.getTextCommands(commandName)
    }

    /** Get a list of all database users */
    public async getAllUsers(): Promise<MazariniUser[]> {
        return await this.db.getAllUsers()
    }

    //TODO: Refactor
    public async deleteSpecificPrefixValues(prefix: keyof MazariniUser) {
        const users = await this.getAllUsers()
        users.forEach((user) => {
            if (prefix === 'status') {
                user[prefix] = undefined
            } else if (prefix === 'dailyClaim') {
                user[prefix] = 0
            }
            this.updateUser(user)
        })
    }

    public async getMemes(): Promise<Meme[]> {
        return await this.db.getMemes()
    }

    static getProperty<T>(o: MazariniUser, name: keyof MazariniUser) {
        return o[name]
    }

    static defaultUser(id: string): MazariniUser {
        return {
            bonkCounter: 0,
            chips: 5000,
            id: id,
            spinCounter: 0,
            warningCounter: 0,
            ATHspin: '00',
            activisionUserString: undefined,
            birthday: undefined,
            codStats: undefined,
            codStatsBR: undefined,
            dailyClaim: 0,
            dailyClaimStreak: undefined,
            dailyFreezeCounter: 0,
            debuff: undefined,
            inventory: undefined,
            lastFMUsername: undefined,
            rocketLeagueUserString: undefined,
            shopItems: undefined,
            status: undefined,
            prestige: 0,
        }
    }

    static defaultCache(): Partial<MazariniStorage> {
        return {
            updateTimer: moment().unix(),
            polls: [],
        }
    }
}
