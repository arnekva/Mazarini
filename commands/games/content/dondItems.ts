import { IUserEffects, MazariniUser } from '../../../interfaces/database/databaseInterface'
import { IEffectItem } from '../../store/lootboxCommands'

export namespace DondItems {
    const defaultEffects: IUserEffects = {
        positive: {},
        negative: {},
    }

    export const veryLowQualityEffects: Array<IEffectItem> = [
        {
            label: '1x doubled potwins',
            message: 'at din neste hasjwin dobles!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.doublePotWins = (user.effects.positive.doublePotWins ?? 0) + 1
                return undefined
            },
        },
        {
            label: '1 free rolls',
            message: '1 gratis /roll!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 1
                return undefined
            },
        },
    ]

    export const lowQualityEffects: Array<IEffectItem> = [
        {
            label: '3x doubled potwins',
            message: 'at dine tre neste hasjwins dobles!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.doublePotWins = (user.effects.positive.doublePotWins ?? 0) + 3
                return undefined
            },
        },
        {
            label: '5 free rolls',
            message: '5 gratis /roll!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 5
                return undefined
            },
        },
        {
            label: '3x lootbox odds in deathroll',
            message: 'at du har 3x større sannsynlighet for å heller få en lootbox som reward ved hasjinnskudd - ut dagen!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.deahtrollLootboxChanceMultiplier = 3
                return undefined
            },
        },
        {
            label: '5x doubled pot additions',
            message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.doublePotDeposit = (user.effects.positive.doublePotDeposit ?? 0) + 5
                return undefined
            },
        },
        {
            label: '1x guaranteed colors',
            message: 'at din neste loot-item har garantert farge (gjelder ikke trade)',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.guaranteedLootColor = (user.effects.positive.guaranteedLootColor ?? 0) + 1
                return undefined
            },
        },
        {
            label: '1 Blackjack re-deal',
            message: 'en ekstra deal på nytt i blackjack!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.blackjackReDeals = (user.effects.positive.blackjackReDeals ?? 0) + 1
                return undefined
            },
        },
    ]
    export const mediumQualityEffects: Array<IEffectItem> = [
        {
            label: '10 spins',
            message: '10 ekstra /spin rewards!',
            effect: (user: MazariniUser) => {
                user.dailySpins = 1
                return undefined
            },
        },
        {
            label: '10 free rolls',
            message: '10 gratis /roll!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 10
                return undefined
            },
        },
        {
            label: 'Flipped color odds',
            message: 'at loot-farge-sannsynlighetene snus på hodet! Du har nå større sannsynlighet for å få diamond enn silver ut dagen!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.lootColorsFlipped = true
                return undefined
            },
        },
        {
            label: '7x doubled pot additions',
            message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.doublePotDeposit = (user.effects.positive.doublePotDeposit ?? 0) + 7
                return undefined
            },
        },
        {
            label: '2x guaranteed colors',
            message: 'at dine neste 2 loot-items har garantert farge (gjelder ikke trade)',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.guaranteedLootColor = (user.effects.positive.guaranteedLootColor ?? 0) + 2
                return undefined
            },
        },
        {
            label: '3 Blackjack re-deal',
            message: 'tre ekstra deal på nytt i blackjack!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.blackjackReDeals = (user.effects.positive.blackjackReDeals ?? 0) + 3
                return undefined
            },
        },
    ]
    export const highQualityEffects: Array<IEffectItem> = [
        {
            label: '8x lootbox odds in deathroll',
            message: 'at du har 8x større sannsynlighet for å heller få en lootbox som reward ved hasjinnskudd - ut dagen!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.deahtrollLootboxChanceMultiplier = 8
                return undefined
            },
        },
        {
            label: '10x doubled pot additions',
            message: 'at dine neste 5 hasjinnskudd hvor du triller over 100 dobles!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.doublePotDeposit = (user.effects.positive.doublePotDeposit ?? 0) + 10
                return undefined
            },
        },
        {
            label: '3x guaranteed colors',
            message: 'at dine neste 3 loot-items har garantert farge (gjelder ikke trade)',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.guaranteedLootColor = (user.effects.positive.guaranteedLootColor ?? 0) + 3
                return undefined
            },
        },
        {
            label: '5 Blackjack re-deal',
            message: 'fem ekstra deal på nytt i blackjack!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.blackjackReDeals = (user.effects.positive.blackjackReDeals ?? 0) + 5
                return undefined
            },
        },
    ]
}
