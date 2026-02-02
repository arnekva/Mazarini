import { AttachmentBuilder, InteractionResponse, Message } from 'discord.js'
import { SimpleContainer } from '../../Abstracts/SimpleContainer'
import { ICCGDeck, ItemRarity } from '../../interfaces/database/databaseInterface'

export interface CCGGame {
    id: string
    player1: CCGPlayer
    player2: CCGPlayer
    message?: InteractionResponse<boolean> | Message<boolean>
    container: SimpleContainer
    state: CCGGameState
    vsBot: boolean
    botDifficulty?: Difficulty
    mode?: Mode
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
}

export type CCGPhase = 'DRAW' | 'PLAY' | 'RESOLVE' | 'END' | 'FINISHED'

export interface CCGEffect {
    cardId: string
    emoji: string
    sourceCardName: string
    sourcePlayerId: string
    targetPlayerId: string
    type: CCGEffectType
    speed: number
    accuracy: number
    cardSuccessful: boolean
    value?: number
    turns?: number
    reflected?: boolean
}

export type CCGEffectType = 'DAMAGE' | 'HEAL' | 'LOSE_ENERGY' | 'REMOVE_STATUS' | 'STEAL_CARD' | CCGStatusEffectType

export interface StatusEffect {
    id: string
    ownerId: string
    sourcePlayerId: string
    type: CCGStatusEffectType
    value: number
    remainingTurns: number
    emoji?: string
}

export type CCGStatusEffectType =
    | 'BLEED'
    | 'SHIELD'
    | 'RETARDED'
    | 'SLOW'
    | 'REFLECT'
    | 'GAIN_ENERGY'
    | 'CHOKESTER'
    | 'CHOKE_SHIELD'
    | 'REDUCE_COST'
    | 'VIEW_HAND'

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
    emoji?: string
    selected?: boolean
}

export interface CCGCardEffect {
    target: CCGTarget
    type: CCGEffectType
    value?: number
    turns?: number
    accuracy?: number
}

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
    userCards: CCGCard[]
    cardImages: Map<string, Buffer>
    filteredCards: CCGCard[]
    deck: ICCGDeck
    page: number
    saved: boolean
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

export enum UsageFilter {
    Used = 'Used',
    Unused = 'Unused',
}

export enum CCGSeries {
    MazariniCCG = 'mazariniCCG',
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
    Deck_rules = 'Deck_regler',
    Deck_builder = 'Deck_bygger',
    Commands = 'Kommandoer',
    Card_acquisition = 'Kortanskaffelse',
    Rewards = 'Belønninger',
    Economy = 'Økonomi',
    Seasons = 'Sesonger',
    Player_stats = 'Spillerstatistikk',
}
