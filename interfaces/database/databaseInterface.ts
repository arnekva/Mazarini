import { IDailyPriceClaim } from '../../commands/gamblingCommands'
import { rocketLeagueDbData } from '../../commands/gameCommands'
import { CodBRStatsType, CodStats } from '../../commands/warzoneCommands'

export interface userValPair {
    key: string
    value: string
    opt?: any
}

export type botDataPrefix = 'status' | 'statusType' | 'version' | 'commit-id'

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
    /** Legacy stats for Warzone 1 */
    codStatsWarzone1?: CodBRStatsType | CodStats
    /** Username for activision. username;platform */
    activisionUserString?: string
    /** Rocket League stats */
    rocketLeagueStats?: rocketLeagueDbData
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
    favoritePol?: FavoritePol
    userStats?: UserStats
    //OUTDATED
}

export type FavoritePol = {
    id?: string
    longitude?: string
    latitude?: string
}
export type UserStats = {
    chipsStats?: ChipsStats
    rulettStats?: RulettStats
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
export interface ChipsStats {
    krigWins?: number
    krigLosses?: number
    gambleWins?: number
    gambleLosses?: number
    slotWins?: number
    slotLosses?: number
    roulettWins?: number
    rouletteLosses?: number
}
export interface RulettStats {
    red?: number
    black?: number
    green?: number
    odd?: number
    even?: number
}
export interface ICountdownItem {
    ownerId: string
    date: Date
    description: string
}
export interface MazariniCountdowns {
    allCountdowns: ICountdownItem[]
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
