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

    /** Very high reward: a token the user spends in the Activities app (More or Less page) to pick tomorrow's More or Less category. Also in the chest effect pool. */
    export const chooseMolReward: IEffectItem = {
        label: 'Velg MOL',
        message: 'en token til å velge morgendagens More or Less-kategori! Bruk den nederst på More or Less-siden i Activity.',
        effect: (user: MazariniUser) => {
            user.molTokens = (user.molTokens ?? 0) + 1
            return undefined
        },
    }

    export const veryLowQualityEffects: Array<IEffectItem> = [
        deathrollPotReward(5000),
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
            label: '2x doubled potwins',
            message: 'at dine to neste hasjwins dobles!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.doublePotWins = (user.effects.positive.doublePotWins ?? 0) + 2
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
        deathrollPotReward(15000),
        {
            label: '2 spin',
            message: '2 ekstra /spin reward!',
            effect: (user: MazariniUser) => {
                user.dailySpins = 2
                return undefined
            },
        },
        {
            label: '15 free rolls',
            message: '15 gratis /roll!',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.freeRolls = (user.effects.positive.freeRolls ?? 0) + 15
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
            label: '1x guaranteed colors',
            message: 'at din neste loot-item har garantert farge (gjelder ikke trade)',
            effect: (user: MazariniUser) => {
                user.effects = user.effects ?? defaultEffects
                user.effects.positive.guaranteedLootColor = (user.effects.positive.guaranteedLootColor ?? 0) + 1
                return undefined
            },
        },
        lootboxReward(LootboxQuality.Premium),
        lootchestReward(LootboxQuality.Basic),
    ]
    export const highQualityEffects: Array<IEffectItem> = [
        deathrollPotReward(30000),
        {
            label: '5 spin',
            message: '5 ekstra /spin reward!',
            effect: (user: MazariniUser) => {
                user.dailySpins = 5
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
        chooseMolReward,
    ]

    /** Basic chests: very low / low. Premium: medium. Elite: high. */
    export const getChestEffects = (quality: string): Array<IEffectItem> => {
        switch (quality.toLowerCase()) {
            case LootboxQuality.Elite:
                return highQualityEffects
            case LootboxQuality.Premium:
                return mediumQualityEffects
            default:
                return [...veryLowQualityEffects, ...lowQualityEffects]
        }
    }

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
