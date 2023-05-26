import { Message, EmbedBuilder, ActionRowBuilder, ButtonInteraction, CacheType } from "discord.js"
import { ICardObject } from "../../cardCommands"

export interface IUserObject {
    name: string
    id: number
    cards: ICardObject[]
}

export interface IRedBlackGame {
    stage: RedBlackStage
    currentPlayer: IUserObject
    
}

export enum RedBlackStage {
    RedBlack = 'RedBlack',
    UpDown = 'UpDown',
    InsideOutside = 'InsideOutside',
    Suit = 'Suit'
}

export interface IGiveTakeGame {
    gtTable: Map<number, IGiveTakeCard>
    currentGtCard: IGiveTakeCard
    gtTableMessage: Message
    gtNextCardId: number
}

export interface IGiveTakeCard {
    card: ICardObject
    give: boolean
    take: boolean
    sips: number
    revealed: boolean
}

export interface IBusRideTable {
    cards: ICardObject[]
}

//kanskje ikke så nødvendig?
export interface IGiveTakeTable {
    levels: IGiveTakeLevel[]
    current: IGiveTakeCard

}

export interface IGiveTakeLevel {
    sips: number
    give: IGiveTakeCard
    take: IGiveTakeCard
    giveTake: IGiveTakeCard
    cards: [IGiveTakeCard, IGiveTakeCard, IGiveTakeCard]
}

// * Veldig kult - funker sykt bra - men ga ikke så mye mening til dette spillet *
// export interface IEditableEphemeralEmbed {
//     interaction: ButtonInteraction
//     embeds: EmbedBuilder
//     buttons: ActionRowBuilder
//     menu: ActionRowBuilder
//     content: ActionRowBuilder
// }

export enum GameStage {
    RedBlack = 'RedBlack',
    GiveTake = 'GiveTake',
    BusRide = 'BusRide'
}

export enum BusRide {
    Standard = 'Standard',
    Canadian = 'Canadian',
    BergenLightRail = 'BergenLightRail'
}

export interface IGameRules {
    gtLevelSips: number[]
    busRide: BusRide
}