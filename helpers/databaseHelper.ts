//https://openbase.com/js/node-json-db
import moment from 'moment'
import { JsonDB } from 'node-json-db'
import { Config } from 'node-json-db/dist/lib/JsonDBConfig'
import { botDataPrefix, ChipsStats, MazariniStorage, MazariniUser, RulettStats } from '../interfaces/database/databaseInterface'

const db = new JsonDB(new Config('myDataBase', true, true, '/'))
const folderPrefix = '/users'
const storagePrefix = '/other'
const botFolder = '/bot'
const textCommandFolder = '/textCommand'

export class DatabaseHelper {
    /**
     * Get a user object by ID.
     * @param userID ID of the user as a string
     * @returns
     */
    static getUser(userID: string): MazariniUser {
        // { [key: string]: MazariniUser }
        try {
            return JSON.parse(db.getData(`${folderPrefix}/${userID}/`)) as MazariniUser
        } catch (error: any) {
            this.updateUser(this.defaultUser(userID, 'Ingen navn'))
            return JSON.parse(db.getData(`${folderPrefix}/${userID}/`)) as MazariniUser
        }
    }

    /** Get an untyped user object. Do not use unless you know what you are doing */
    static getUntypedUser(userID: string): any | undefined {
        try {
            return JSON.parse(db.getData(`${folderPrefix}/${userID}/`)) as MazariniUser as any
        } catch (error: any) {
            return undefined
        }
    }

    /** Update the user object in DB */
    static updateUser(userObject: MazariniUser) {
        const objToPush = JSON.stringify(userObject)
        db.push(`${folderPrefix}/${userObject.id}/`, `${objToPush}`)
    }

    /** Get the cache. Will create and return an empty object if it doesnt exist */
    static getStorage(): MazariniStorage {
        try {
            return JSON.parse(db.getData(`${storagePrefix}/`)) as MazariniStorage
        } catch (error: any) {
            db.push(`${storagePrefix}/`, `${JSON.stringify(this.defaultCache())}`)
            return JSON.parse(db.getData(`${storagePrefix}/`)) as MazariniStorage
        }
    }

    /** Directly uppdates the storage with the given props.
     * Note that this will overwrite existing cache. Any data you want to keep must be added to the partial. Use getCache() to get the current cache value */
    static updateStorage(props: Partial<Omit<MazariniStorage, 'updateTimer'>>) {
        const cache = this.getStorage()
        for (const prop in props) {
            cache[prop] = props[prop]
        }
        cache.updateTimer = moment(new Date()).unix()
        const objToPush = JSON.stringify(cache)
        db.push(`${storagePrefix}/`, `${objToPush}`)
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

    static getBotData(prefix: botDataPrefix) {
        let data
        try {
            data = db.getData(`${botFolder}/${prefix}`)
        } catch (error) {
            //No data;
        }
        return data
    }

    static setBotData(prefix: botDataPrefix, value: any) {
        db.push(`${botFolder}/${prefix}`, value)
    }

    static setTextCommandValue(commandName: string, value: any) {
        db.push(`${textCommandFolder}/${commandName}[]`, value)
    }
    static nukeTextCommand(commandName: string, value: any) {
        db.delete(`${textCommandFolder}/${commandName}`)
    }
    static getTextCommandValueArray(commandName: string) {
        let data
        try {
            data = db.getData(`${textCommandFolder}/${commandName}`)
        } catch (error) {
            //No data;
        }
        return data
    }

    /**
     * This returns an object with all the id's as keys.
     * @deprecated Use getAllUsers()
     */
    static getAllUserIdsAsObject() {
        return db.getData('/users')
    }

    /** Get a list of all database users */
    static getAllUsers(): MazariniUser[] {
        const users = db.getData('/users')
        const typedUsersList = Object.values(users) as MazariniUser[]
        return typedUsersList
    }

    static deleteSpecificPrefixValues(prefix: keyof MazariniUser) {
        const users = this.getAllUserIdsAsObject()
        Object.keys(users).forEach((key) => {
            const user = this.getUser(key)

            if (prefix === 'status') {
                user[prefix] = undefined
            } else if (prefix === 'dailyClaim') {
                user[prefix] = 0
            }
            DatabaseHelper.updateUser(user)
        })
    }

    static getProperty<T>(o: MazariniUser, name: keyof MazariniUser) {
        return o[name]
    }

    static defaultUser(id: string, name: string): MazariniUser {
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
        }
    }
}
