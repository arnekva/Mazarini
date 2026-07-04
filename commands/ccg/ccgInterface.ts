import { AttachmentBuilder, InteractionResponse, Message } from 'discord.js'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { ICCGDeck, ItemRarity } from '../../interfaces/database/databaseInterface'

export interface CCGGame {
    id: string
    channelId: string
    player1: CCGPlayer
    player2: CCGPlayer
    message?: InteractionResponse<boolean> | Message<boolean>
    container: SimpleContainer
    state: CCGGameState
    vsBot: boolean
    summary: CCGSummary
    botDifficulty?: Difficulty
    mode?: Mode
    cardSet?: CardSet
    wager?: number
}

export enum Difficulty {
    Easy = 'easy',
    Medium = 'medium',
    Hard = 'hard',
}

export enum Mode {
    Practice = 'practice',
    Reward = 'reward',
}

export enum CardSet {
    Standard = 'standard',
    Wild = 'wild',
}

export interface CCGPlayerStats {
    opponentId?: string
    difficulty?: Difficulty
    won: number
    lost: number
    chipsWon: number
    gamesPlayed: number
    cardsPlayed: CCGCardStats[]
    damageDealt: number
    damageTaken: number
    statused: CCGStatusStats[]
    hits: number
    misses: number
}

export interface CCGCardStats {
    cardId: string
    timesPlayed: number
}

export interface CCGStatusStats {
    statusName: string
    amount: number
}

export interface CCGGameState {
    phase: CCGPhase
    turn: number
    stack: CCGEffect[] // resolving effects
    statusEffects: StatusEffect[] // shields, reduced cost, energy recovery, etc.
    statusConditions: StatusEffect[] // chokester, bleed, slow, etc..
    log: CCGLogEntry[] // optional but VERY useful
    winnerId?: string
    settings: CCGGameSettings
    locked: boolean // disable most buttons when locked
    playedCardsAllGame: { playerId: string; round: number; cards: CCGCard[] }[]
    expiredViewHandIds?: string[]
    resolveIndex?: number
}

export type CCGPhase = 'DRAW' | 'PLAY' | 'RESOLVE' | 'END' | 'FINISHED'

export interface CCGEffect {
    cardId: string
    emoji: string
    statusText?: string
    sourceCardName: string
    sourceCardId: string
    sourcePlayerId: string
    targetPlayerId: string
    cardTarget?: CCGTarget
    type: CCGEffectType
    speed: number
    accuracy: number
    cardSuccessful: boolean
    value?: number
    turns?: number
    reflected?: boolean
    condition?: CCGCondition | CCGCondition[]
    statusAccuracy?: number
    includeCurrentTurn?: boolean
    transformCardId?: string
    transformSeries?: string
    identifier?: CardIdentifier
    summonCardId?: string
    amount?: number
    delayedTrigger?: boolean
    countTarget?: 'SELF' | 'OPPONENT' | 'BOTH'
    base?: number
    reflectType?: ReflectType
    ignoreDefense?: boolean
    cardIds?: string[]
    toDeckTop?: boolean
    charges?: number
    statusType?: CCGStatusEffectType
} //TODO: is this getting out of hand? Do we need to split this into multiple interfaces or classes? Maybe have a base CCGEffect and then extend it for different types of effects that require different properties?

export type CCGEffectType =
    | 'DAMAGE'
    | 'HEAL'
    | 'LOSE_ENERGY'
    | 'REMOVE_STATUS'
    | 'STEAL_CARD'
    | 'STEAL_ENERGY'
    | 'NEUTRALIZE_ATTACK'
    | 'SUMMON_CARD'
    | 'DISCARD_CARD'
    | 'GAMBLE'
    | 'FIRST_STRIKE'
    | 'SHOOT'
    | 'TRANSFORM'
    | 'CLAIM_BOUNTY'
    | 'DAMAGE_PER_IDENTIFIER'
    | 'DAMAGE_PER_CARD_PLAYED'
    | 'COPY_CARD'
    | 'HEAL_PER_OPPONENT_COST'
    | 'DAMAGE_PER_OPPONENT_COST'
    | 'INCREASE_MAX_HP'
    | 'PRANK'
    | 'COLLECT_CARD'
    | 'MOVE_TO_TOP'
    | 'AUROR'
    | 'SACRIFICE_CARD'
    | 'MODIFY_COST_PERMANENT'
    | 'SHUFFLE_CARD'
    | 'SET_ENERGY'
    | 'SET_HP'
    | 'DAMAGE_BY_RESOLVE_ORDER'
    | 'SWAP_ENERGY'
    | 'EQUALIZE_HP'
    | 'SORT_DECK'
    | 'FILL_HAND_RUBBER_DUCK'
    | CCGStatusEffectType

export type ReflectType = 'damage' | 'allEffects' | 'all' | CCGEffectType[]

export interface StatusEffect {
    id: string
    ownerId: string
    sourcePlayerId: string
    type: CCGStatusEffectType
    value: number
    remainingTurns: number
    accuracy?: number
    emoji?: string
    includeCurrentTurn?: boolean
    createdOnTurn?: number
    identifier?: CardIdentifier
    delayedTrigger?: boolean
    reflectType?: ReflectType
    charges?: number
}

export type CCGStatusEffectType =
    | 'BLEED'
    | 'SHIELD'
    | 'RETARDED'
    | 'MYGLING'
    | 'EIVINDPRIDE'
    | 'WAITING'
    | 'SLOW'
    | 'REFLECT'
    | 'GAIN_ENERGY'
    | 'CHOKESTER'
    | 'CHOKE_SHIELD'
    | 'REDUCE_COST'
    | 'VIEW_HAND'
    | 'RECOVER'
    | 'SPEED_BUFF'
    | 'DAMAGE_BOOST'
    | 'EXTRA_CARDS'
    | 'ELUSIVE'
    | 'SHOCK'
    | 'ARMOR'
    | 'BOUNTY'
    | 'BUILD_DEATHSTAR'
    | 'DESTROY_DEATHSTAR'
    | 'PERSISTENT_APPEARANCE'
    | 'HEAL_BOOST'
    | 'HEAL_REDUCTION'
    | 'RESTRICT_CARDS'
    | 'SLEEP'
    | 'CANNOT_MISS'
    | 'RANDOMIZE_COST'
    | 'CANNOT_DIE'
    | 'FORESIGHT'
    | 'DEATH_EATER_BOUNTY'
    | 'BLANK_HAND'
    | 'RANDOMIZE_ACCURACY'
    | 'OBFUSCATE_HAND'

export interface CCGLogEntry {
    turn: number
    message: string
}

export interface CCGGameSettings {
    startingHP: number
    startingEnergy: number
    fatigueDamage: number
    openHands: boolean
    defaultHandSize: number
    maxHandSize: number
    energyRecoveryPerRound: number
    maxCardsPlayed: number
}

export interface CCGPlayer {
    id: string
    name: string
    deck: CCGCard[]
    hand: CCGCard[]
    usedCards: CCGCard[]
    handMessage: InteractionResponse<boolean> | Message<boolean>
    energy: number
    hp: number
    maxHp?: number
    submitted: boolean
    opponentId: string
    stunned: boolean
    stats: CCGPlayerStats
    cardbackEmoji: string
}

export interface CCGCard {
    id: string
    name: string
    series: string
    type: CCGCardType
    effects: CCGCardEffect[]
    cost: number
    rarity: ItemRarity
    accuracy: number
    speed: number
    cannotMiss?: boolean
    emoji?: string
    selected?: boolean
    identifier?: CardIdentifier[]
    customDescription?: string
    nameFontSize?: number
    randomizedCost?: number
    effectImmunities?: CCGStatusEffectType[]
    summoned?: boolean
    consumable?: boolean
    collectible?: boolean
    /** Permanently removed (not recycled into used pile) when discarded — e.g. Rubber Duck */
    removeOnDiscard?: boolean
    /** When true, only cost is rendered on the card (name/description/speed/accuracy are hidden) */
    blank?: boolean
}

export interface CCGCondition {
    type:
        | 'ALWAYS'
        | 'RANDOM'
        | 'HP_BELOW'
        | 'HP_ABOVE'
        | 'ENERGY_BELOW'
        | 'ENERGY_ABOVE'
        | 'HAS_STATUS'
        | 'NOT_HAS_STATUS'
        | 'BUILD_DEATHSTAR'
        | 'PLAYED_CARD_ID'
        | 'PLAYED_CARD_IDENTIFIER'
        | 'PLAYED_EFFECT_TYPE'
        | 'NUM_CARDS_PLAYED'
    target: CCGTarget
    value?: number
    status?: CCGStatusEffectType
    chance?: number
    effectType?: CCGEffectType
    cardId?: string
    identifier?: CardIdentifier
    comparator?: '<' | '<=' | '==' | '!=' | '>=' | '>'
    invert?: boolean
}

export interface CCGCardEffect {
    target: CCGTarget
    type: CCGEffectType
    value?: number
    amount?: number
    turns?: number
    accuracy?: number
    statusAccuracy?: number
    includeCurrentTurn?: boolean
    condition?: CCGCondition | CCGCondition[]
    transformCardId?: string
    transformSeries?: string
    identifier?: CardIdentifier
    summonCardId?: string
    gambleGroup?: string
    delayedTrigger?: boolean
    countTarget?: 'SELF' | 'OPPONENT' | 'BOTH'
    base?: number
    reflectType?: ReflectType
    ignoreDefense?: boolean
    cardIds?: string[]
    toDeckTop?: boolean
    charges?: number
    statusType?: CCGStatusEffectType
}

export type HpIdentifier =
    | 'GRYFFINDOR'
    | 'SLYTHERIN'
    | 'RAVENCLAW'
    | 'HUFFLEPUFF'
    | 'DEATH_EATER'
    | 'SEEKER'
    | 'MAGICAL_CREATURE'
    | 'HOUSE_ELF'
    | 'POTION'
    | 'AUROR'
export type CardIdentifier = SwIdentifier | HpIdentifier
export type SwIdentifier = 'REBEL' | 'SITH' | 'JEDI' | 'REPUBLIC' | 'BOUNTY_HUNTER' | 'CREATURE' | 'EMPIRE' | 'DROID'
export type CCGTarget = 'SELF' | 'OPPONENT'

export enum CCGCardType {
    Attack = 'attack',
    Shield = 'shield',
    Heal = 'heal',
    Effect = 'effect',
}

export interface DeckEditor {
    id: string
    userId: string
    userColor: number
    typeFilters: CCGCardType[]
    rarityFilters: ItemRarity[]
    usageFilters: UsageFilter[]
    seriesFilters: CCGSeries[]
    amountFilters: AmountFilter[]
    identifierFilters: CardIdentifier[]
    standardFilter: boolean
    userCards: CCGCard[]
    cardImages: Map<string, Buffer>
    filteredCards: CCGCard[]
    deck: ICCGDeck
    page: number
    saved: boolean
    isTradeEditor: boolean
    validationErrors?: string[]
    deckInfo?: {
        container?: SimpleContainer
        message?: Message | InteractionResponse
    }
    cardView?: {
        attachments?: AttachmentBuilder[]
        container?: SimpleContainer
        message?: Message | InteractionResponse
    }
}

export enum AmountFilter {
    ThreePlus = '3+',
}

export enum UsageFilter {
    Used = 'Used',
    Unused = 'Unused',
}

export enum CCGSeries {
    MazariniCCG = 'mazariniCCG',
    SwCCG = 'swCCG',
    HpCCG = 'hpCCG',
}

export interface CCGHelper {
    id: string
    selectedCategory: CCGHelperCategory
    selectedSubCategory: CCGHelperSubCategory
    info?: {
        container?: SimpleContainer
        message?: Message | InteractionResponse
    }
}

export enum CCGHelperCategory {
    Gameplay = 'Gameplay',
    Cards = 'Kort',
    Decks = 'Decks',
    Progression = 'Progresjon',
    Stats = 'Stats',
}

export enum CCGHelperSubCategory {
    Game_modes = 'Spillmoduser',
    Rounds = 'Runder',
    Card_resolution = 'Kortavvikling',
    Statuses_and_effects = 'Statuser_og_effekter',
    Winning_and_losing = 'Vinne_og_tape',
    Card_anatomy = 'Kortstruktur',
    Balancing = 'Balansering',
    Trading = 'Trading',
    Deck_rules = 'Deck_regler',
    Deck_builder = 'Deck_bygger',
    Commands = 'Kommandoer',
    Card_acquisition = 'Kortanskaffelse',
    Rewards = 'Belønninger',
    Economy = 'Økonomi',
    Seasons = 'Sesonger',
    Player_stats = 'Spillerstatistikk',
}

export interface CCGSummary {
    visible: boolean
    round: number
}

export interface CCGStats {
    id: string
    guildId: string
    stats: Map<string, CCGPlayerStats[]>
    stat1Id: string
    stat2Id: string
    difficulty?: Difficulty
    info?: {
        container?: SimpleContainer
        message?: Message | InteractionResponse
    }
}
