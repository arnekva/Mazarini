import { MessageHelper } from './messageHelper'
import * as cleanTextUtils from 'clean-text-utils'
import { escapeString } from '../utils/textUtils'

//https://openbase.com/js/node-json-db
import { JsonDB } from 'node-json-db'
import { Config } from 'node-json-db/dist/lib/JsonDBConfig'
const db = new JsonDB(new Config('myDataBase', true, true, '/'))
const folderPrefix = '/users'
const otherFolderPreifx = '/other'
import emojiStrip from 'emoji-strip'
import { write } from 'fs'
import { achievementIDs } from '../commands/achievements'
import { Message } from 'discord.js'
import { shopItem } from '../commands/shop'

//const db = new Database()
/**
 * Denne kan senere utvides. Bruker for å passe på at alle verdier som skal inn i databasen samsvarer
 */
export interface userValPair {
    key: string
    value: string
    opt?: any
}

export interface dbObject {
    name: string
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
    itemList: shopItem[]
}

export interface debuffItem {
    item: string
    amount: number
}
export class DatabaseHelper {
    /**
     * @param prefix - Databaseprefix. Må være av type dbprefix. Nye prefixer MÅ legges til i typen på toppen av databaseHelper.
     * @param key - Nøkkel: Her bruker du vanligvis brukernavn (message.author.username)
     * @param value - Verdi som settes i databasen
     */
    static setValue(prefix: dbPrefix, key: string, value: string) {
        db.push(`${folderPrefix}/${key}/${prefix}`, `${value}`)
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

    static setStoreItems(key: string, itemList: itemsBoughtAtStore) {
        const prefix: dbPrefix = 'shopItems'
        db.push(`${folderPrefix}/${key}/${prefix}`, `${itemList}`)
    }

    static getAllCountdownValues() {
        return db.getData(`${otherFolderPreifx}/countdown/`)
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
    static setAchievementObject(prefix: dbPrefix, key: string, achievementID: achievementIDs, value: any) {
        db.push(`${folderPrefix}/${key}/${prefix}/${achievementID}`, `${value}`)
    }
    /** Increment verdien for en int som ligger i databasen */
    static incrementValue(prefix: dbPrefix, key: string, increment: string) {
        const oldValue = DatabaseHelper.getValueWithoutMessage(prefix, key)
        if (isNaN(oldValue)) {
            DatabaseHelper.setValue(prefix, key, increment)
        } else {
            const newVal = Number(oldValue) + Number(increment)
            DatabaseHelper.setValue(prefix, key, newVal.toFixed(2))
        }
    }
    static incrementCleanValue(prefix: dbPrefix, key: string, increment: string) {
        const oldValue = DatabaseHelper.getValueWithoutMessage(prefix, key)
        if (isNaN(oldValue)) {
            DatabaseHelper.setValue(prefix, key, increment)
        } else {
            const newVal = Number(oldValue) + Number(increment)
            DatabaseHelper.setValue(prefix, key, newVal.toFixed(0))
        }
    }
    static decrementValue(prefix: dbPrefix, key: string, decrement: string) {
        const oldValue = DatabaseHelper.getValueWithoutMessage(prefix, key)
        const newVal = Number(oldValue) - Number(decrement)

        DatabaseHelper.setValue(prefix, key, newVal > 0 ? newVal.toFixed(2) : '0.00')
    }
    static getAchievement(prefix: dbPrefix, key: string, achievementID: achievementIDs) {
        let data
        try {
            data = db.getData(`${folderPrefix}/${key}/${prefix}/${achievementID}`)
        } catch (error) {
            //No data;
        }
        return data
    }
    /** For missing folders, like achievement, you can add them using this */
    static addUserFolder(key: string, prefix: dbPrefix) {
        db.push(`${folderPrefix}/${key}/${prefix}`, {})
    }

    /**
     *
     * @param prefix Databaseprefix - Verdien fra brukeren du er ute etter
     * @param key Brukernavn
     * @param message Message objekt er nødvendig for å kunne gi finne brukere
     * @param noInsertions FUnksjonen oppretter en tom verdi hvis den ikke eksisterer. Sett denne true dersom den IKKE skal opprette default verdi hvis den ikke finnes
     * @returns
     */
    static getValue(prefix: dbPrefix, key: string, message: Message, noInsertions?: boolean) {
        try {
            const data = db.getData(`${folderPrefix}/${key}/${prefix}`)
            return data
        } catch (error) {
            if (noInsertions) return ''

            const val = DatabaseHelper.valueToPush(prefix)
            if (DatabaseHelper.findUserByUsername(key, message)) db.push(`${folderPrefix}/${key}/${prefix}`, val)
            else {
                message.reply('brukeren finnes ikke. Hvis brukeren har mellomrom i navnet, bruk under_strek')
                return undefined
            }
            return '0'
        }
    }
    /** Hent en verdi uten message objektet. Vil ikke replye med error hvis ikke funnet. */
    static getValueWithoutMessage(prefix: dbPrefix, key: string) {
        try {
            const data = db.getData(`${folderPrefix}/${key}/${prefix}`)
            return data
        } catch (error) {
            return undefined
        }
    }
    /** Finn default verdi å sette i databasen hvis det ikke eksisterer.  */
    static valueToPush(prefix: dbPrefix) {
        if (prefix === 'achievement') return {}
        else if (prefix === 'spin' || prefix == 'ATHspin') return '00'
        else return '0'
    }
    /** Hent alle brukere */
    static async getAllUsers() {
        return db.getData('/users')
    }
    /** Slett et aktivt bet */
    static deleteActiveBet(username: string) {
        db.delete(`${otherFolderPreifx}/activeBet/${username}`)
    }
    static deleteSpecificPrefixValues(prefix: dbPrefix) {
        const users = db.getData(`${folderPrefix}`)
        Object.keys(users).forEach((el) => {
            db.delete(`${folderPrefix}/${el}/${prefix}`)
        })
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

    /**
     * FIXME: This abomination
     * Ser gjennom alle brukere og sammenligner 1 med 2. Hvis 2 er større, setter funksjonen 1 = 2;
     * Unnskyld fremtidige mennesker som ska prøva å tyda dette her.
     * @param prefix1 Compare
     * @param prefix2 Compare
     */
    static compareAndUpdateValue(prefix1: dbPrefix, prefix2: dbPrefix) {
        const users = db.getData(`${folderPrefix}`)
        Object.keys(users).forEach((el) => {
            Object.keys(users[el]).forEach((el2) => {
                if (el2 == prefix1) {
                    Object.keys(users[el]).forEach((el4) => {
                        if (el4 == prefix2) {
                            if (users[el][el2] < users[el][el4]) {
                                DatabaseHelper.setValue(prefix1, el, users[el][el4])
                            }
                        }
                    })
                }
            })
        })
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
            return
        }
    }
    /** Hent alle verdier for en gitt prefix */
    static getAllValuesFromPrefix(prefix: dbPrefix, message: Message) {
        const users = db.getData(`${folderPrefix}`)
        const valueList: ValuePair[] = []
        Object.keys(users).forEach((el) => {
            const val = DatabaseHelper.getValue(prefix, el, message, true)

            if (val) valueList.push({ key: el, val: val })
        })
        return valueList
    }

    static getAllValuesFromPrefixWithoutMessage(prefix: dbPrefix) {
        const users = db.getData(`${folderPrefix}`)
        const valueList: ValuePair[] = []
        Object.keys(users).forEach((el) => {
            const val = DatabaseHelper.getValueWithoutMessage(prefix, el)
            if (val) valueList.push({ key: el, val: val })
        })
        return valueList
    }
    static async nukeDatabase() {
        /*await db.empty().then(() => {
            console.log("Database slettet. Alle verdier er fjernet.")
        })*/
    }
    /** Fjern prefix fra en string */
    static stripPrefixFromString(text: string, prefix: dbPrefix) {
        return text.replace(prefix + '-', '')
    }

    static setShoppingList(username: string, shopItems: shopItem[]) {
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
