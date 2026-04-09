import { IUserEffects, LootboxQuality, MazariniEventRewardTier, MazariniUser } from '../../../interfaces/database/databaseInterface'
import { IEffectItem } from '../../store/lootboxCommands'

export namespace DondItems {
    const defaultEffects: IUserEffects = {
        positive: {},
        negative: {},
    }

    const shardReward = (amount: number): IEffectItem => ({
        label: `${amount} shards`,
        message: `${amount} shards!`,
        effect: (user: MazariniUser) => {
            user.ccg = {
                ...user.ccg,
                shards: (user.ccg?.shards ?? 0) + amount,
            }
            return undefined
        },
    })

    const packReward = (): IEffectItem => ({
        label: '1 pack',
        message: '1 pack!',
        effect: () => undefined,
        lootReward: {
            type: 'pack',
            quality: LootboxQuality.Basic,
        },
    })

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
        shardReward(2),
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
        shardReward(5),
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
            label: '1 spin',
            message: '1 ekstra /spin reward!',
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
        shardReward(10),
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
        shardReward(15),
        packReward(),
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

    export const getRewardsForQuality = (quality: MazariniEventRewardTier) => {
        switch (quality) {
            case MazariniEventRewardTier.VeryLow:
                return veryLowQualityEffects
            case MazariniEventRewardTier.Low:
                return lowQualityEffects
            case MazariniEventRewardTier.Medium:
                return mediumQualityEffects
            case MazariniEventRewardTier.High:
                return highQualityEffects
        }
    }
}
