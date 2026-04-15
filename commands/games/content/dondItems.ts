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

    const deathrollPotReward = (amount: number): IEffectItem => ({
        label: `${amount} til deathroll potten`,
        message: `at deathroll potten økes med ${amount}!`,
        effect: async (_user: MazariniUser, db) => {
            const currentPot = (await db?.getDeathrollPot()) ?? 0
            db?.saveDeathrollPot(currentPot + amount)
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
        shardReward(2),
        deathrollPotReward(5000),
        {
            label: '3 free rolls',
            message: '3 gratis /roll!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 3
                return undefined
            },
        },
    ]

    export const lowQualityEffects: Array<IEffectItem> = [
        {
            label: '1x doubled potwins',
            message: 'at din neste hasjwins dobles!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.doublePotWins = (user.effects.positive.doublePotWins ?? 0) + 1
                return undefined
            },
        },

        shardReward(5),
        deathrollPotReward(10000),
        {
            label: '1 Blackjack re-deal',
            message: 'en ekstra deal på nytt i blackjack!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.blackjackReDeals = (user.effects.positive.blackjackReDeals ?? 0) + 1
                return undefined
            },
        },
        {
            label: '1 spin',
            message: '1 ekstra /spin reward!',
            effect: (user: MazariniUser) => {
                user.dailySpins = 1
                return undefined
            },
        },
    ]
    export const mediumQualityEffects: Array<IEffectItem> = [
        {
            label: '2 spin',
            message: '2 ekstra /spin reward!',
            effect: (user: MazariniUser) => {
                user.dailySpins = 2
                return undefined
            },
        },
        {
            label: '7 free rolls',
            message: '7 gratis /roll!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 7
                return undefined
            },
        },
        shardReward(10),
        packReward(),
        {
            label: '2x doubled pot additions',
            message: 'at dine neste 2 hasjinnskudd hvor du triller over 100 dobles!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.doublePotDeposit = (user.effects.positive.doublePotDeposit ?? 0) + 7
                return undefined
            },
        },
        {
            label: '1 Blackjack re-deal',
            message: 'en ekstra deal på nytt i blackjack!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.blackjackReDeals = (user.effects.positive.blackjackReDeals ?? 0) + 3
                return undefined
            },
        },
    ]
    export const highQualityEffects: Array<IEffectItem> = [
        {
            label: '3x doubled pot additions',
            message: 'at dine neste 3 hasjinnskudd hvor du triller over 100 dobles!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.doublePotDeposit = (user.effects.positive.doublePotDeposit ?? 0) + 10
                return undefined
            },
        },
        shardReward(15),
        packReward(),
        {
            label: '4 Blackjack re-deal',
            message: 'fire ekstra deal på nytt i blackjack!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.blackjackReDeals = (user.effects.positive.blackjackReDeals ?? 0) + 5
                return undefined
            },
        },
        {
            label: '3 spin',
            message: '3 ekstra /spin reward!',
            effect: (user: MazariniUser) => {
                user.dailySpins = 3
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
