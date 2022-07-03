import { Message } from 'discord.js'
//https://openbase.com/js/node-json-db
import { JsonDB } from 'node-json-db'
import { Config } from 'node-json-db/dist/lib/JsonDBConfig'
import { IDailyPriceClaim } from '../commands/gamblingCommands'
import { inventoryItem } from '../commands/shop'
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

    /** Bursdagsdato dd-mm-yyyy */
    birthday?: string
    /** Dagens status. Slettes hver dag 06:00 */
    status?: string
    /** Total antall spins */
    spinCounter: number //TODO?
    /** Høyeste spin tid */
    ATHspin?: string
    /** Antall chips */
    chips: number
    /** Antall coins */
    coins: number
    /** Antall warnings */
    warningCounter: number
    /** Antall bonks */
    bonkCounter: number
    /** Brukernavn for last.fm */
    lastFMUsername?: string
    /** Antall lån gjort */
    loanCounter: number
    /** Nåværende gjeld */
    debt: number
    /** Gjeld */
    debtPenalty: number | string
    debtMultiplier: number
    /** Gjenstander fra shopen */
    shopItems?: any //TODO Cast this
    /** Lagrede stats for Cod weekly stats */
    codStats?: CodStats | CodBRStatsType
    /** Lagrede stats for Cod BR */
    codStatsBR?: CodBRStatsType | CodStats
    /** Brukernavn for activision. username;platform */
    activisionUserString?: string
    /** Brukernavn for rocket league. username;platform */
    rocketLeagueUserString?: string
    /** Brukernavn */
    displayName: string
    inventory?: inventoryItem[] //TODO Cast this
    debuff?: any //TODO Cast this
    dailyClaim?: number
    dailyClaimStreak?: IDailyPriceClaim
    dailyFreezeCounter?: number
    prestige?: number
    favoritePol?: string
}
export type dbPrefix =
    | 'spin'
    | 'birthday'
    | 'stock'
    | 'mygling'
    | 'week'
    | 'counterSpin'
    | 'ATHspin'
    | 'sCounterWeeklySpin'
    | 'chips'
    | 'bailout'
    | 'warningCounter'
    | 'dogeCoin'
    | 'test'
    | 'achievement'
    | 'bonkCounter'
    | 'lastFmUsername'
    | 'loanCounter'
    | 'debt'
    | 'debtPenalty'
    | 'debtMultiplier'
    | 'shopItems'
    | 'codStats'
    | 'codStatsBR'
    | 'activisionUserString'
    | 'rocketLeagueUserString'
    | 'cancelledCounter'
    | 'nickname'
    | 'inventory'
    | 'debuff'
    | 'dailyClaim'
    | 'dailyClaimStreak'
    | 'prestige'
    | 'dailyFreezeCounter'
    | 'birthday'
    | 'favoritePol'

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
    itemList: inventoryItem[]
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
    /** Hent et brukerobjekt på ID. De fleste verdier kan være undefined. Hvis brukeren ikke finnes så opprettes det et objekt med default verdier */
    static getUser(userID: string): MazariniUser {
        // { [key: string]: MazariniUser }
        try {
            return JSON.parse(db.getData(`${folderPrefix}/${userID}/`)) as MazariniUser
        } catch (error: any) {
            this.updateUser(this.defaultUser(userID, 'Ingen navn'))
            return JSON.parse(db.getData(`${folderPrefix}/${userID}/`)) as MazariniUser
        }
    }

    /** Hent et untyped User objekt. Brukes kun i admin.setSpecificValue() */
    static getUntypedUser(userID: string): any | undefined {
        // { [key: string]: MazariniUser }
        try {
            return JSON.parse(db.getData(`${folderPrefix}/${userID}/`)) as MazariniUser
        } catch (error: any) {
            return undefined
        }
    }

    /** Oppdater brukerobjektet i databasen */
    static updateUser(userObject: MazariniUser) {
        const objToPush = JSON.stringify(userObject)
        db.push(`${folderPrefix}/${userObject.id}/`, `${objToPush}`)
    }

    static setObjectValue(prefix: dbPrefix, key: string, value: any) {
        db.push(`${folderPrefix}/${key}/${prefix}`, `${value}`)
    }
    /** Sett en verdi i "other"-delen av databasen */
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

    static setStoreItems(key: string, itemList: itemsBoughtAtStore) {
        const prefix: dbPrefix = 'shopItems'
        db.push(`${folderPrefix}/${key}/${prefix}`, `${itemList}`)
    }

    static getAllCountdownValues() {
        return db.getData(`${otherFolderPreifx}/countdown/`)
    }
    static getAllFerieValues() {
        return db.getData(`${otherFolderPreifx}/ferie/`)
    }
    /** Hent en verdi i "other"-delen av databasen */
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
    /** Knytter et bet til en bruker */
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

    /** Finn default verdi å sette i databasen hvis det ikke eksisterer.  */
    static getDefaultPrefixValue(prefix: dbPrefix) {
        if (prefix === 'achievement') return {}
        else if (prefix === 'spin' || prefix == 'ATHspin') return '00'
        else return '0'
    }
    /** Hent alle brukere */
    static getAllUsers() {
        return db.getData('/users')
    }
    /** Slett et aktivt bet */
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

    /** Fjern prefix fra en string */
    static stripPrefixFromString(text: string, prefix: dbPrefix) {
        return text.replace(prefix + '-', '')
    }

    static setShoppingList(username: string, shopItems: inventoryItem[]) {
        shopItems.forEach((item) => {
            db.push(`${folderPrefix}/${username}/inventory/${item.name}/name`, `${item.name}`)
            db.push(`${folderPrefix}/${username}/inventory/${item.name}/price`, `${item.price}`)
            db.push(`${folderPrefix}/${username}/inventory/${item.name}/description`, `${item.description}`)
            try {
                let mengde = db.getData(`${folderPrefix}/${username}/inventory/${item.name}/amount`) + 1
                db.push(`${folderPrefix}/${username}/inventory/${item.name}/amount`, mengde)
            } catch (error) {
                db.push(`${folderPrefix}/${username}/inventory/${item.name}/amount`, 1)
            }
        })
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
            coins: 150,
            debt: 0,
            debtMultiplier: 0,
            debtPenalty: 0,
            id: id,
            loanCounter: 0,
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
    'spin',
    'birthday',
    'stock',
    'mygling',
    'week',
    'counterSpin',
    'ATHspin',
    'sCounterWeeklySpin',
    'chips',
    'bailout',
    'warningCounter',
    'dogeCoin',
    'test',
    'achievement',
    'bonkCounter',
    'lastFmUsername',
    'loanCounter',
    'debt',
    'debtPenalty',
    'debtMultiplier',
    'shopItems',
    'codStats',
    'codStatsBR',
    'activisionUserString',
    'rocketLeagueUserString',
    'cancelledCounter',
    'nickname',
    'inventory',
    'debuff',
    'dailyClaim',
    'dailyClaimStreak',
    'prestige',
    'dailyFreezeCounter',
    'birthday',
    'favoritePol',
]
