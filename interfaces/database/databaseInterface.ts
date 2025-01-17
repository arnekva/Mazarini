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
    animated: boolean
    weeklyAverage?: number
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
    //** Counter of attempted frame jobs current day */
    attemptedFrameJobs?: number
}

export interface MazariniUser {
    /** User id */
    id: string
    /**  dd-mm-yyyy */
    birthday?: string
    /** Custom status */
    status?: string
    /** No.  chips */
    chips: number
    /** No. warnings */
    warningCounter: number
    /** No. bonks */
    bonkCounter: number
    lastFMUsername?: string
    dailySpinRewards?: number
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
    daily?: DailyReward
    favoritePol?: FavoritePol
    userStats?: UserStats
    hasBeenRobbed?: boolean
    jail?: UserJail
    /** Saved as date string */
    whamageddonLoss?: string
    textCommandStrings?: string[]
    collectables?: IUserCollectable[]
    userSettings?: IUserSettings
    effects?: IUserEffects
    christmasCalendar?: UserCalendarGift[]
}

export interface IUserSettings {
    safeGambleValue?: number
    allowNonDupesInTrade?: boolean
}

export interface UserCalendarGift {
    date: Date
    calendarGiftId: number
    opened: boolean
}

export interface DailyReward {
    streak: number
    claimedToday: boolean
    dailyFreezeCounter?: number
    prestige?: number
}

export interface IUserEffects {
    positive?: IUserBuffs
    negative?: IUserDebuffs
}

export interface IUserBuffs {
    jailPass?: number
    doublePotWins?: number
    freeRolls?: number
    lootColorChanceMultiplier?: number
    doublePotDeposit?: number
    lootColorsFlipped?: boolean
    deahtrollLootboxChanceMultiplier?: number
    blackjackReDeals?: number
}

export interface IUserDebuffs {}

export interface ILootSystem {
    boxes: ILootbox[]
    series: ICollectableSeries[]
}

export interface ICollectableSeries {
    name: string
    added: Date
    common: string[]
    rare: string[]
    epic: string[]
    legendary: string[]
}

export interface IUserCollectable {
    name: string
    series: string
    rarity: ItemRarity
    color: ItemColor
    amount: number
}

export enum ItemRarity {
    Common = 'common',
    Rare = 'rare',
    Epic = 'epic',
    Legendary = 'legendary',
}

export enum ItemColor {
    None = 'none',
    Silver = 'silver',
    Gold = 'gold',
    Diamond = 'diamond',
}

export enum LootboxQuality {
    Basic = 'basic',
    Premium = 'premium',
    Elite = 'elite',
    Limited = 'limited',
}

export interface ILootbox {
    name: string
    price: number
    probabilities: ILootboxDistribution
    validFrom?: Date
    validTo?: Date
}

export interface ILootboxDistribution {
    common: number
    rare: number
    epic: number
    legendary: number
    color: number
}

interface ISavedMessage {
    messageId: string
    purpose?: 'rocket-league'
}

/** Values or objects that can be cached. All props must be marked optional */
export interface MazariniStorage {
    /** Timer of when the storage was last updated. Updated automatically when storage is changed */
    updateTimer: number
    rocketLeagueTournaments?: {
        mainMessageId: string
        tournaments: RocketLeagueTournament[]
    }

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
    savedMessages?: ISavedMessage[]
    deathrollPot?: number
    loot?: ILootSystem
}

export interface ICache {
    deathrollWinningNumbers: number[]
}

export type FavoritePol = {
    id?: string
    longitude?: string
    latitude?: string
}
export type UserStats = {
    chipsStats?: ChipsStats
    rulettStats?: RulettStats
    deathrollStats?: DeathrollStats
    moneyStats?: MoneyStats
}
interface MoneyStats {
    totalLost: number
    totalWon: number
}
export interface DeathrollStats {
    totalGames: number
    totalLosses: number
    weeklyLosses?: number
    weeklyGames?: number
    weeklyLossSum?: number
    biggestLoss?: number[]
    currentLossStreak?: number
    longestLossStreak?: number
    potSkips?: number
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
    blackjackLosses?: number
    blackjackWins?: number
    blackjackDraws?: number
    blackjackLossDealer21?: number
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
    boxes?: MemeBox[]
}

export interface MemeBox {
    x?: number
    y?: number
    width?: number
    height?: number
    color?: string
    outline_color?: string
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
