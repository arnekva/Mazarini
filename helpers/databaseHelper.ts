import { Message } from 'discord.js'
//https://openbase.com/js/node-json-db
import { JsonDB } from 'node-json-db'
import { Config } from 'node-json-db/dist/lib/JsonDBConfig'
import { IDailyPriceClaim } from '../commands/gamblingCommands'
import { CodBRStatsType, CodStats } from '../commands/warzoneCommands'

const db = new JsonDB(new Config('myDataBase', true, true, '/'))
const folderPrefix = '/users'
const otherFolderPreifx = '/other'
const botFolder = '/bot'
const textCommandFolder = '/textCommand'

//const db = new Database()
/**
 * Denne kan senere utvides. Bruker for å passe på at alle verdier som skal inn i databasen samsvarer
 */
export interface userValPair {
    key: string
    value: string
    opt?: any
}

export type botDataPrefix = 'status' | 'statusType'

export interface MazariniUser {
    /** User id */
    id: string

    /**  dd-mm-yyyy */
    birthday?: string
    /** Custom status */
    status?: string
    /** Total spins */
    spinCounter: number //TODO?

    ATHspin?: string
    /** No.  chips */
    chips: number

    /** No. warnings */
    warningCounter: number
    /** No. bonks */
    bonkCounter: number

    lastFMUsername?: string
    /** No. loans */

    shopItems?: any //TODO Cast this
    /** Cod weekly stats */
    codStats?: CodStats | CodBRStatsType
    /**Cod BR */
    codStatsBR?: CodBRStatsType | CodStats
    /** Username for activision. username;platform */
    activisionUserString?: string
    /** Username for rocket league. username;platform */
    rocketLeagueUserString?: string
    /** Displayname */
    displayName: string
    inventory?: any[]
    debuff?: any
    dailyClaim?: number
    dailyClaimStreak?: IDailyPriceClaim
    dailyFreezeCounter?: number
    prestige?: number
    favoritePol?: string
    //OUTDATED
}
export type dbPrefix =
    | 'birthday'
    | 'spinCounter'
    | 'favoritePol'
    | 'prestige'
    | 'dailyFreezeCounter'
    | 'dailyClaimStreak'
    | 'dailyClaim'
    | 'debuff'
    | 'inventory'
    | 'displayName'
    | 'rocketLeagueUserString'
    | 'activisionUserString'
    | 'codStatsBR'
    | 'codStats'
    | 'codStats'
    | 'codStatsBR'
    | 'lastFMUsername'
    | 'bonkCounter'
    | 'warningCounter'
    | 'chips'
    | 'ATHspin'
    | 'status'
    | 'id'

export interface betObject {
    description: string
    value: string
    positivePeople: string[]
    negativePeople: string[]
    messageId: string
}
export interface betObjectReturned {
    discriminator: 'BETOBJECT'
    description: string
    value: string
    positivePeople: string
    negativePeople: string
    messageId: string
}

export interface itemsBoughtAtStore {
    itemList: any[]
}

export interface debuffItem {
    item: string
    amount: number
}

export interface ferieItem {
    fromDate: Date
    toDate: Date
}
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

    /** Get an untyped user object */
    static getUntypedUser(userID: string): any | undefined {
        // { [key: string]: MazariniUser }
        try {
            return JSON.parse(db.getData(`${folderPrefix}/${userID}/`)) as MazariniUser
        } catch (error: any) {
            return undefined
        }
    }

    /** Update the user object in DB */
    static updateUser(userObject: MazariniUser) {
        const objToPush = JSON.stringify(userObject)
        db.push(`${folderPrefix}/${userObject.id}/`, `${objToPush}`)
    }

    static setObjectValue(prefix: dbPrefix, key: string, value: any) {
        db.push(`${folderPrefix}/${key}/${prefix}`, `${value}`)
    }
    /** Update a non-user value in the database */
    static setNonUserValue(id: string, key: string, value: string) {
        db.push(`${otherFolderPreifx}/${id}/${key}`, `${value}`)
    }
    static setCountdownValue(id: string, key: string, value: string) {
        db.push(`${otherFolderPreifx}/countdown/${id}/${key}`, `${value}`)
    }
    static deleteCountdownValue(id: string) {
        db.delete(`${otherFolderPreifx}/countdown/${id}/`)
    }
    static setFerieValue(id: string, key: string, value: string) {
        db.push(`${otherFolderPreifx}/ferie/${id}/${key}`, `${value}`)
    }
    static deleteFerieValue(id: string) {
        db.delete(`${otherFolderPreifx}/ferie/${id}/`)
    }

    static getAllCountdownValues() {
        return db.getData(`${otherFolderPreifx}/countdown/`)
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
    static getAllNonUserValueFromPrefix(id: string) {
        try {
            const data = db.getData(`${otherFolderPreifx}/${id}`)
            return data
        } catch (error) {
            return ''
        }
    }

    static setActiveBetObject(key: string, value: betObject) {
        db.push(`${otherFolderPreifx}/activeBet/${key}/positivePeople`, `${value.positivePeople}`)
        db.push(`${otherFolderPreifx}/activeBet/${key}/negativePeople`, `${value.negativePeople}`)
        db.push(`${otherFolderPreifx}/activeBet/${key}/value`, `${value.value}`)
        db.push(`${otherFolderPreifx}/activeBet/${key}/description`, `${value.description}`)
        db.push(`${otherFolderPreifx}/activeBet/${key}/messageId`, `${value.messageId}`)
    }
    /**
     * TODO: Attempt to set override to false?
     * @param key Name of person who said the quote
     */
    static setQuoteObject(key: string, quote: string) {
        //TODO: Need to push quote-object to list under key, such that we can retrive all quotes by person X.
        db.push(`${otherFolderPreifx}/quotes/${key}[]`, quote)
    }

    static getActiveBetObject(key: string) {
        try {
            const data = db.getData(`${otherFolderPreifx}/activeBet/${key}`)
            return data
        } catch (error) {
            return undefined
        }
    }
    static setBetObject(key: string, messageId: string, value: betObject) {
        db.push(`${otherFolderPreifx}/storedBets/${messageId}/positive`, `${value.positivePeople}`)
        db.push(`${otherFolderPreifx}/storedBets/${messageId}/negative`, `${value.negativePeople}`)
    }

    /** For missing folders, like achievement, you can add them using this */
    static addUserFolder(key: string, prefix: dbPrefix) {
        db.push(`${folderPrefix}/${key}/${prefix}`, {})
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

    static getDefaultPrefixValue(prefix: dbPrefix) {
        if (prefix == 'ATHspin') return '00'
        else return '0'
    }

    static getAllUsers() {
        return db.getData('/users')
    }

    static deleteActiveBet(username: string) {
        db.delete(`${otherFolderPreifx}/activeBet/${username}`)
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
    /**
     * @deprecated Bruk UserUtils i stedet
     */
    static findUserByUsername(username: string, rawMessage: Message) {
        return rawMessage.client.users.cache.find((user) => user.username == username)
    }
    /**
     * @deprecated Bruk UserUtils i stedet
     */
    static findUserById(id: string, rawMessage: Message) {
        return rawMessage.client.users.cache.find((user) => user.id == id)
    }

    static decreaseInventoryItem(item: String, username: String) {
        try {
            const mengde = db.getData(`${folderPrefix}/${username}/inventory/${item}/amount`) - 1
            if (mengde <= 0) {
                db.delete(`${folderPrefix}/${username}/inventory/${item}`)
            } else {
                db.push(`${folderPrefix}/${username}/inventory/${item}/amount`, mengde)
            }
        } catch (error) {
            return undefined
        }
    }

    static getAllValuesFromPath(path: string) {
        try {
            return db.getData(`${path}`)
        } catch (error) {
            //nothing yet
        }
    }
    static getValueFromPath(path: string) {
        return db.getData(`${path}`)
    }

    static stripPrefixFromString(text: string, prefix: dbPrefix) {
        return text.replace(prefix + '-', '')
    }

    static increaseDebuff(target: string, item: string) {
        try {
            const mengde = db.getData(`${folderPrefix}/${target}/debuff/${item}/amount`)
            if (mengde <= 0 || mengde == undefined) {
                db.push(`${folderPrefix}/${target}/debuff/${item}/name`, `${item}`)
                db.push(`${folderPrefix}/${target}/debuff/${item}/amount`, `1`)
            } else {
                db.push(`${folderPrefix}/${target}/debuff/${item}/amount`, mengde + 1)
            }
        } catch (error) {
            db.push(`${folderPrefix}/${target}/debuff/${item}/name`, `${item}`)
            db.push(`${folderPrefix}/${target}/debuff/${item}/amount`, 1)
        }
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
export interface ValuePair {
    key: string
    val: string
}
export interface ValuePair {
    key: string
    val: string
}
export interface prefixVal {
    anyName: string
}

export const prefixList: dbPrefix[] = [
    'birthday',
    'spinCounter',
    'favoritePol',
    'prestige',
    'dailyFreezeCounter',
    'dailyClaimStreak',
    'dailyClaim',
    'displayName',
    'rocketLeagueUserString',
    'activisionUserString',
    'codStatsBR',
    'codStats',
    'codStats',
    'codStatsBR',
    'lastFMUsername',
    'bonkCounter',
    'warningCounter',
    'chips',
    'ATHspin',
    'status',
    'id',
]
