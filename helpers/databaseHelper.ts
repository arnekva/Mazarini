//https://openbase.com/js/node-json-db
import { JsonDB } from 'node-json-db'
import { Config } from 'node-json-db/dist/lib/JsonDBConfig'
import { botDataPrefix, ChipsStats, MazariniCountdowns, MazariniUser, RulettStats } from '../interfaces/database/databaseInterface'

const db = new JsonDB(new Config('myDataBase', true, true, '/'))
const folderPrefix = '/users'
const otherFolderPreifx = '/other'
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

    static setFerieValue(id: string, key: string, value: string) {
        db.push(`${otherFolderPreifx}/ferie/${id}/${key}`, `${value}`)
    }
    static deleteFerieValue(id: string) {
        db.delete(`${otherFolderPreifx}/ferie/${id}/`)
    }

    static getCountdowns(): MazariniCountdowns | undefined {
        try {
            const cds = JSON.parse(db.getData(`${otherFolderPreifx}/countdowns/`)) as MazariniCountdowns
            if (!cds.allCountdowns) {
                const objToPush = JSON.stringify({ allCountdowns: [] })
                db.push(`${otherFolderPreifx}/countdowns/`, `${objToPush}`)
            }
            return cds
        } catch (error: any) {
            return undefined
        }
    }
    static updateCountdowns(cd: MazariniCountdowns) {
        const objToPush = JSON.stringify(cd)
        db.push(`${otherFolderPreifx}/countdowns/`, `${objToPush}`)
    }

    static deleteCountdownValue(id: string) {
        const cds = DatabaseHelper.getCountdowns()
        cds.allCountdowns = cds.allCountdowns.filter((c) => c.ownerId !== id)
        DatabaseHelper.updateCountdowns(cds)
    }

    static getAllFerieValues() {
        return db.getData(`${otherFolderPreifx}/ferie/`)
    }
    /** Get a non-user value */
    static getNonUserValue(id: string, key: string, noInsertions?: boolean) {
        try {
            const data = db.getData(`${otherFolderPreifx}/${id}/${key}`)
            return data
        } catch (error) {
            if (noInsertions) return ''
            db.push(`${otherFolderPreifx}/${id}/${key}`, `0`)
            return '0'
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

    static getAllUsers() {
        return db.getData('/users')
    }

    static deleteSpecificPrefixValues(prefix: keyof MazariniUser) {
        const users = this.getAllUsers()
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
            displayName: name,
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
}
