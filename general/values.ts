// Centralized values for game balancing across Deathroll, More or Less, Spinner, Daily, etc.
// Edit these values to balance rewards, multipliers, streaks, etc. for all games.

type dailyReward = number | 'dond' | 'box' | 'chest'
export type GameValuesType = {
    deathroll: {
        winningNumberRanges: [number, number][]
        /** Defines what counts as a pot-skip (for tracking stats only) */
        potSkip: { diceTarget: number; roll: number }
        addToPot: {
            /** When on new ATH streak, this multiplier will be applied to streak */
            athStreakMultiplier: number
            /** Default streak multiplier (i.e. if this is 1000, a streak of 5 will be 5*1000 = 5000) */
            streakMultiplier: number
            /** when new biggest loss (top 10) is recorded, multiply with this value */
            biggestLossMultiplier: number
            /** When player loses on a >100 dice, buts its NOT an ATH, multiply by this number instead */
            largeNumberLossMultiplier: number
            /** A reward has to exceed this number to trigger a text entry in the response message */
            minReward: number
        }
        jokes: {
            /** Amount to remove if rolled 9 on target 11 */
            nineElevenRemove: number
            /** Chance of occuring */
            nineElevenChance: number
        }
        checkForReward: {
            /** Multiplier when all digits are the same */
            sameDigitsMultiplier: number
            /** Multiplier when all digits are 0 except first (e.g. 100, 2000, 30000 etc) */
            allDigitsExceptFirstAreZeroMultiplier: number
            /** When roll == target (i.e. rolls 131 on a 1 - 131) */
            diceTargetMultiplier: number
            /** Rolling a 2 will result in this number being added to the pot */
            roll2Reward: number
            /** The effect multiplier users can get from rewards. */
            doublePotDepositMultiplier: number
            /** Multipliers will not be taken into effect if roll is below this */
            minRollForMultiplier: number
            /** FIXME: Might not be needed? */
            minPotForDouble: number
            /** FIXME: Might not be needed? */
            maxDoubleReward: number
            /** Chance of getting a lootbox instead of pot addition when rolling a special number */
            lootboxChance: number
            lootbox: {
                basic: { min: number; max: number; cost: number }
                premium: { min: number; max: number; cost: number }
                elite: { min: number; max: number; cost: number }
            }
        }
        getRollReward: {
            /** All special numbers that will trigger a reward  */
            specialNumbers: number[]
            /** Multiplier for special numbers */
            multiplier: number
        }
        tomasa: {
            baseChance: number
            roll1ChanceDivisor: number
        }
        potWin: {
            /** Main win number */
            winOn: number
            /** Minimum game start number to be eligeble for pot win */
            minTarget: number
            /** "Nei takk" button is only displayed when won value is below this */
            noThanksThreshold: number
            /** Value added to pot when player presses "Nei takk" button */
            noThanksBonus: number
        }
        /** Default suggestion when starting new deathroll game */
        autoCompleteDiceDefault: number
        /** Maximum amount of games printed in deathroll list */
        printCurrentStateMaxFields: number
    }
    moreOrLess: {
        tier1Reward: number
        tier2Reward: number
        tier3Reward: number
        tier4Reward: number
        tier5Reward: number
        tier6Reward: number
    }
    spinner: {
        spinWeights: Array<{ value: number; weight: number }>
        rewards: { [key: number]: number }
    }
    daily: {
        baseReward: number
        streakMultiplier: number
        streak4Reward: dailyReward
        streak7Reward: dailyReward
    }
    slotMachine: {
        cost: number
        sequenceWins: { [key: string]: number }
        streakWins: { [key: number]: number } & { default: number }
    }
    pantelotteriet: {
        minChips: number
        maxChips: number
        rewards: Array<{ chance: number; amount: number }>
        default: number
    }
    dealOrNoDeal: {
        effectItemChance: number
        offerBase: number
        offerPerRound: number
    }
    blackjack: {
        deathrollRefundEnabled: boolean
    }
}

export const GameValues: GameValuesType = {
    // Deathroll
    deathroll: {
        winningNumberRanges: [
            [75, 100],
            [101, 125],
            [126, 150],
            [151, 175],
            [176, 200],
            [201, 10002],
        ],
        potSkip: { diceTarget: 200, roll: 69 },
        addToPot: {
            athStreakMultiplier: 1500,
            streakMultiplier: 1000,
            biggestLossMultiplier: 35,
            largeNumberLossMultiplier: 3,
            minReward: 100,
        },
        jokes: {
            nineElevenRemove: 2977,
            nineElevenChance: 0.65,
        },
        checkForReward: {
            sameDigitsMultiplier: 5,
            allDigitsExceptFirstAreZeroMultiplier: 5,
            diceTargetMultiplier: 10,
            roll2Reward: 20,
            doublePotDepositMultiplier: 2,
            minRollForMultiplier: 100,
            minPotForDouble: 1000,
            maxDoubleReward: 2500,
            lootboxChance: 8,
            lootbox: {
                basic: { min: 0, max: 9999, cost: 5000 },
                premium: { min: 10000, max: 24999, cost: 10000 },
                elite: { min: 25000, max: Infinity, cost: 25000 },
            },
        },
        getRollReward: {
            specialNumbers: [
                1996, 1997, 1881, 1337, 1030, 1349, 1814, 1905, 669, 690, 8008, 6969, 420, 123, 1234, 12345, 2469, 1984, 2024, 2025, 2012, 1945, 2468, 1359,
            ],
            multiplier: 5,
        },
        tomasa: {
            baseChance: 0.001,
            roll1ChanceDivisor: 1000,
        },
        potWin: {
            winOn: 69,
            minTarget: 10000,
            noThanksThreshold: 10000,
            noThanksBonus: 5000,
        },
        autoCompleteDiceDefault: 10002,
        printCurrentStateMaxFields: 25,
    },

    // More or Less
    moreOrLess: {
        tier1Reward: 700, // 1-10
        tier2Reward: 500, // 11-20
        tier3Reward: 300, // 21-30
        tier4Reward: 200, // 31-40
        tier5Reward: 100, // 41-50
        tier6Reward: 50, // 51+
    },

    // Spinner
    spinner: {
        spinWeights: [
            { value: 0, weight: 38.39 },
            { value: 1, weight: 23.73 },
            { value: 2, weight: 14.66 },
            { value: 3, weight: 9.06 },
            { value: 4, weight: 5.6 },
            { value: 5, weight: 3.46 },
            { value: 6, weight: 2.14 },
            { value: 7, weight: 1.3 },
            { value: 8, weight: 0.82 },
            { value: 9, weight: 0.51 },
            { value: 10, weight: 0.31 },
        ],
        rewards: {
            2: 75,
            3: 110,
            4: 250,
            5: 500,
            6: 800,
            7: 1600,
            8: 3000,
            9: 6000,
            10: 12000,
            10.59: 30000, // Special case for 10 min, 59 sec
        },
    },

    // Daily Claim
    daily: {
        baseReward: 500,
        streakMultiplier: 1.0, // Multiplies with streak
        streak4Reward: 'dond',
        streak7Reward: 'chest',
        // Add more as needed
    },

    // Slot Machine
    slotMachine: {
        cost: 500,
        sequenceWins: {
            '123': 1250,
            '1337': 5000,
            '1996': 5000,
            '1997': 5000,
            '8008': 5000,
            '1234': 5000,
            '12345': 25000,
            '80085': 25000,
            '123456': 50000,
            default: 500,
        },
        streakWins: {
            2: 750,
            3: 1000,
            4: 4000,
            5: 15000,
            6: 25000,
            default: 500,
        },
    },

    // Pantelotteriet
    pantelotteriet: {
        minChips: 0,
        maxChips: 1000,
        rewards: [
            { chance: 1 / 100000, amount: 50000 },
            { chance: 1 / 10000, amount: 5000 },
            { chance: 1 / 2500, amount: 1000 },
            { chance: 1 / 250, amount: 100 },
            { chance: 1 / 100, amount: 50 },
        ],
        default: 0,
    },

    // Deal Or No Deal
    dealOrNoDeal: {
        effectItemChance: 40, // percent chance to get an effect item
        offerBase: 0.5, // base offer percentage
        offerPerRound: 0.05, // offer percentage increase per round
    },

    // Blackjack
    blackjack: {
        deathrollRefundEnabled: true, // If true, lostAddedBack is shown and refund is applied
    },
}
