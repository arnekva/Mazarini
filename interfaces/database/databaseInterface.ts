import { CodBRStatsType, CodStats } from '../../commands/gaming/callofdutyCommands'
import { rocketLeagueDbData } from '../../commands/gaming/rocketleagueCommands'
import { IPoll } from '../../commands/pollcommands'

export interface DatabaseStructure {
    bot: BotData
    memes: Meme[]
    other: MazariniStorage
    users: MazariniUser[]
    stats: MazariniStats
}

export interface userValPair {
    key: string
    value: string
    opt?: any
}

export interface BotData {
    commitId: string
    status: string
    statusType: number
    version: string
}

export interface MazariniStats {
    emojis: EmojiStats[]
}

export interface EmojiStats {
    name: string
    timesUsedInMessages: number
    timesUsedInReactions: number
    added: Date[]
    removed: Date[]
}

export type botDataPrefix = 'status' | 'statusType' | 'version' | 'commit-id'
export type JailState = 'solitairy' | 'max' | 'standard' | 'none'

export interface UserJail {
    /** Days remaining of sentence */
    daysInJail?: number
    /** Counter of attempted jailbreaks current day. Resets with daily jobs */
    attemptedJailbreaks?: number
    /** Current jail state - standard, max or solitairy. Defines what is allowed to do (i.e. bribe, jailbreak) */
    jailState?: JailState
    /** Counter for how many times a user has been jailed today. Used to calculate next sentence state */
    timesJailedToday?: number
}

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

    // shopItems?: any //TODO Cast this
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
    vivinoId?: string
    // inventory?: any[]
    // debuff?: any
    daily?: DailyReward
    favoritePol?: FavoritePol
    userStats?: UserStats
    hasBeenRobbed?: boolean
    jail?: UserJail
    /** Saved as date string */
    whamageddonLoss?: string
    textCommandStrings?: string[]
}

export interface DailyReward {
    streak: number
    claimedToday: boolean
    dailyFreezeCounter?: number
    prestige?: number
}

/** Values or objects that can be cached. All props must be marked optional */
export interface MazariniStorage {
    /** Timer of when the storage was last updated. Updated automatically when storage is changed */
    updateTimer: number
    rocketLeagueTournaments?: RocketLeagueTournament[]
    /** List of countdowns */
    countdown?: MazariniCountdowns
    /** List of ferier */
    ferie?: {
        /** Id of user/owner */
        id: string
        /** Stringied feireItem */
        value: ferieItem
    }[]
    polls?: IPoll[]
    scheduledMessages?: IScheduledMessage[]
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
    | 'daysInJail'
    | 'attemptedJailbreaks'

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
    tags?: string[]
}

export interface MazariniCountdowns {
    allCountdowns?: ICountdownItem[]
}

export interface RocketLeagueTournament {
    id: number
    players: number
    starts: string | Date
    mode: string
    shouldNotify?: boolean
}

export interface Meme {
    id: string
    name: string
    url: string
    width: number
    height: number
    box_count: number
    captions: number
    tags: string[]
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

export interface IScheduledMessage {
    message: string
    /** Saved as unix timestamp */
    dateToSendOn: number
    channelId: string
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
    'lastFMUsername',
    'bonkCounter',
    'warningCounter',
    'chips',
    'ATHspin',
    'status',
    'id',
    'daysInJail',
    'attemptedJailbreaks',
]
