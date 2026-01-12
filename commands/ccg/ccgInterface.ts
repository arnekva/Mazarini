import { InteractionResponse, Message } from 'discord.js'
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
}

export enum Difficulty {
    Easy = 'easy',
    Medium = 'medium',
    Hard = 'hard',
}

export interface CCGGameState {
    phase: CCGPhase
    turn: number
    stack: CCGEffect[] // resolving effects
    statusEffects: StatusEffect[] // burn, stun, shields, etc.
    log: CCGLogEntry[] // optional but VERY useful
    winnerId?: string
    settings: CCGGameSettings
    locked: boolean // disable most buttons when locked
}

export type CCGPhase = 'DRAW' | 'PLAY' | 'RESOLVE' | 'END' | 'FINISHED'

export interface CCGEffect {
    emoji: string
    sourceCardName: string
    sourcePlayerId: string
    targetPlayerId: string
    type: CCGEffectType
    speed: number
    accuracy: number
    value?: number
    turns?: number
    reflected?: boolean
}

export type CCGEffectType = 'DAMAGE' | 'HEAL' | 'DRAW' | 'COUNTER' | 'GAIN_ENERGY' | 'LOSE_ENERGY' | 'ADD_TO_STACK' | CCGStatusEffectType

export interface StatusEffect {
    id: string
    ownerId: string
    type: CCGStatusEffectType
    value: number
    remainingTurns: number
}

export type CCGStatusEffectType = 'BURN' | 'SHIELD' | 'STUN' | 'LOCK' | 'REFLECT' | 'GAIN_ENERGY'

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
}

export interface CCGCard {
    id: string
    name: string
    series: string
    type: CCGCardType // Mostly used for design of card
    effects: CCGCardEffect[]
    cost: number
    rarity: ItemRarity
    accuracy: number
    speed: number
    typeValue: number
    imageUrl: string
    emoji: string
    selected?: boolean
}

export interface CCGCardEffect {
    target: CCGTarget
    type: CCGEffectType
    value?: number
    turns?: number
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
    filteredCards: CCGCard[]
    deck: ICCGDeck
    page: number
    validationErrors?: string[]
    deckInfo?: {
        container?: SimpleContainer
        message?: Message | InteractionResponse
    }
    cardView?: {
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
    info?: {
        container?: SimpleContainer
        message?: Message | InteractionResponse
    }
}

export enum CCGHelperCategory {
    Gameplay = 'Gameplay',
    Cards = 'Cards',
    Deck = 'Deck',
    Rules = 'Rules',
}
