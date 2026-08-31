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
            await db?.saveDeathrollPot(currentPot + amount)
            return undefined
        },
        syncClientCache: (client) => {
            client.cache.deathrollPot = (client.cache.deathrollPot ?? 0) + amount
        },
    })

    const packReward = (quality: LootboxQuality): IEffectItem => ({
        label: '1 pack',
        message: '1 pack!',
        effect: () => undefined,
        lootReward: {
            type: 'pack',
            quality: LootboxQuality.Basic,
        },
    })

    const lootboxReward = (quality: LootboxQuality): IEffectItem => ({
        label: `${quality} lootbox!`,
        message: `${quality} lootbox!`,
        effect: () => undefined,
        lootReward: {
            type: 'box',
            quality: quality,
        },
    })

    const lootchestReward = (quality: LootboxQuality): IEffectItem => ({
        label: `${quality} lootchest!`,
        message: `${quality} lootchest!`,
        effect: () => undefined,
        lootReward: {
            type: 'chest',
            quality: quality,
        },
    })

    export const veryLowQualityEffects: Array<IEffectItem> = [
        deathrollPotReward(5000),
        {
            label: '5 free rolls',
            message: '3 gratis /roll!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 3
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
        {
            label: '1x doubled potwins',
            message: 'at din neste hasjwins dobles!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.doublePotWins = (user.effects.positive.doublePotWins ?? 0) + 1
                return undefined
            },
        },
    ]

    export const lowQualityEffects: Array<IEffectItem> = [
        deathrollPotReward(10000),
        {
            label: '2 Blackjack re-deal',
            message: 'en ekstra deal på nytt i blackjack!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.blackjackReDeals = (user.effects.positive.blackjackReDeals ?? 0) + 2
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
        lootboxReward(LootboxQuality.Basic),
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
        {
            label: 'Flipped color odds',
            message: 'at loot-farge-sannsynlighetene snus på hodet! Du har nå større sannsynlighet for å få diamond enn silver ut dagen!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.lootColorsFlipped = true
                return undefined
            },
        },
        lootboxReward(LootboxQuality.Premium),
        lootchestReward(LootboxQuality.Basic),
    ]
    export const highQualityEffects: Array<IEffectItem> = [
        {
            label: '3 spin',
            message: '3 ekstra /spin reward!',
            effect: (user: MazariniUser) => {
                user.dailySpins = 3
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
        lootboxReward(LootboxQuality.Elite),
        lootchestReward(LootboxQuality.Premium),
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
