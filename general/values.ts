// Centralized values for game balancing across Deathroll, More or Less, Spinner, Daily, etc.
// Edit these values to balance rewards, multipliers, streaks, etc. for all games.

import { ICCGDeck, ItemRarity } from '../interfaces/database/databaseInterface'

type rewardType = number | 'dond' | 'box' | 'chest' | 'pack'
export type GameValuesType = {
    deathroll: {
        winningNumberRanges: [number, number][]
        /** Defines what counts as a pot-skip (for tracking stats only) */
        potSkip: { diceTarget: number; roll: number; potPenalty: number }
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
            unSpecialNumbers: number[]
            /** Multiplier for special numbers */
            multiplier: number
            /** Penalty applied when hitting an unspecial number (negative value) */
            unSpecialNumberPenalty: number
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
        canGetFreeBlackackRedeal: boolean
        shuffleIgnoresDigitsDefault: boolean
    }
    moreOrLess: {
        rewards: {
            tier1: number
            tier2: number
            tier3: number
            tier4: number
            tier5: number
            tier6: number
            completed: number
            bestAttempt: number
        }
    }
    spinner: {
        spinWeights: Array<{ value: number; weight: number }>
        rewards: { [key: number]: number }
    }
    daily: {
        baseReward: number
        streakMultiplier: number
        streak4Reward: rewardType
        streak7Reward: rewardType
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
    wordle: {
        reward: number
        wordleCapPerPerson: number
    }
    loot: {
        chestEffectOdds: {
            basic: number
            premium: number
            elite: number
        }
        artPrice: number
    }
    mastermind: {
        totalAttempts: number
        codeLength: number
        winnerReward: number
    }
    misc: {
        idJokeReward: number
    }
    ccg: {
        gameSettings: {
            defaultHandSize: number
            maxHandSize: number
            startingHP: number
            energyRecoveryPerRound: number
            openHands: boolean
            fatigueDamage: number
            startingEnergy: number
            maxCardsPlayed: number
        }
        rewards: {
            entryFee: number
            dailyBonus: number
            weeklyLimit: number
            win: number
            loss: number
            difficultyMultiplier: {
                easy: number
                medium: number
                hard: number
            }
        }
        deck: {
            size: number
            hiddenEditor: boolean
            cardsPerPage: number
            rarityCaps: {
                rare: number
                epic: number
                legendary: number
            }
            typeCaps: {
                HEAL: number
                REFLECT: number
                SHIELD: number
                CHOKESTER: number
                RETARDED: number
                STEAL_CARD: number
                REDUCE_COST: number
            }
        }
        status: {
            slow_speedDivideBy: number
            chokester_accuracy: number
            bleed_damage: number
        }
        isLootable: boolean
        activeCCGseries: string[]
        defaultDeck: ICCGDeck
        defaultCardback: string
        botDeck: {
            easy: ICCGDeck
            medium: ICCGDeck
            hard: ICCGDeck
        }
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
        potSkip: { diceTarget: 200, roll: 69, potPenalty: 0 },
        addToPot: {
            athStreakMultiplier: 2000,
            streakMultiplier: 1000,
            biggestLossMultiplier: 20,
            largeNumberLossMultiplier: 3,
            minReward: 100,
        },
        jokes: {
            nineElevenRemove: 2977,
            nineElevenChance: 0.25,
        },
        checkForReward: {
            sameDigitsMultiplier: 3,
            allDigitsExceptFirstAreZeroMultiplier: 3,
            diceTargetMultiplier: 3,
            roll2Reward: 5,
            doublePotDepositMultiplier: 2,
            minRollForMultiplier: 100,
            minPotForDouble: 1000,
            maxDoubleReward: 2500,
            lootboxChance: 0,
            lootbox: {
                basic: { min: 0, max: 9999, cost: 5000 },
                premium: { min: 10000, max: 24999, cost: 10000 },
                elite: { min: 25000, max: Infinity, cost: 25000 },
            },
        },
        getRollReward: {
            specialNumbers: [
                1996, 1997, 1881, 1337, 1030, 1349, 1814, 1905, 669, 690, 8008, 6969, 420, 123, 1234, 12345, 2469, 1984, 2026, 2012, 1945, 2468, 1359, 6900,
                2026, 4060, 1989,
            ],
            unSpecialNumbers: [2025, 2027, 68, 70],
            multiplier: 1,
            unSpecialNumberPenalty: -1,
        },
        tomasa: {
            baseChance: 0.001,
            roll1ChanceDivisor: 1000,
        },
        potWin: {
            winOn: 69,
            minTarget: 10000,
            noThanksThreshold: 10000,
            noThanksBonus: 2500,
        },
        autoCompleteDiceDefault: 10002,
        printCurrentStateMaxFields: 25,
        canGetFreeBlackackRedeal: false,
        shuffleIgnoresDigitsDefault: false,
    },

    // More or Less
    moreOrLess: {
        rewards: {
            tier1: 200, // 1-10
            tier2: 200, // 11-20
            tier3: 200, // 21-30
            tier4: 200, // 31-40
            tier5: 200, // 41-50
            tier6: 50, // 51+
            completed: 2500,
            bestAttempt: 2500,
        },
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
            2: 50,
            3: 75,
            4: 100,
            5: 125,
            6: 300,
            7: 500,
            8: 800,
            9: 1250,
            10: 5000,
            10.59: 20000, // Special case for 10 min, 59 sec
        },
    },

    // Daily Claim
    daily: {
        baseReward: 1000,
        streakMultiplier: 1.0, // Multiplies with streak
        streak4Reward: 1000,
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
        effectItemChance: 10, // percent chance to get an effect item
        offerBase: 0.5, // base offer percentage
        offerPerRound: 0.05, // offer percentage increase per round
    },

    // Blackjack
    blackjack: {
        deathrollRefundEnabled: false, // If true, lostAddedBack is shown and refund is applied
    },
    wordle: {
        reward: 10000,
        wordleCapPerPerson: 2500,
    },
    loot: {
        chestEffectOdds: {
            basic: 0.2,
            premium: 0.4,
            elite: 1,
        },
        artPrice: 10000,
    },
    mastermind: {
        totalAttempts: 10,
        codeLength: 4,
        winnerReward: 2500,
    },
    misc: {
        idJokeReward: 1000,
    },
    ccg: {
        gameSettings: {
            defaultHandSize: 4,
            maxHandSize: 5,
            startingHP: 20,
            energyRecoveryPerRound: 1,
            startingEnergy: 3,
            openHands: false,
            fatigueDamage: 0,
            maxCardsPlayed: 2,
        },
        rewards: {
            entryFee: 10000,
            dailyBonus: 10,
            weeklyLimit: 100,
            win: 10,
            loss: 5,
            difficultyMultiplier: {
                easy: 1,
                medium: 1.5,
                hard: 2,
            },
        },
        deck: {
            size: 12,
            hiddenEditor: false,
            cardsPerPage: 4,
            rarityCaps: {
                rare: 8,
                epic: 2,
                legendary: 1,
            },
            typeCaps: {
                HEAL: 2,
                REFLECT: 2,
                SHIELD: 3,
                RETARDED: 1,
                CHOKESTER: 1,
                STEAL_CARD: 1,
                REDUCE_COST: 1,
            },
        },
        status: {
            slow_speedDivideBy: 2,
            chokester_accuracy: 50,
            bleed_damage: 1,
        },
        isLootable: false,
        activeCCGseries: ['mazariniCCG'],
        defaultDeck: {
            name: 'default',
            active: true,
            valid: true,
            cards: [
                { id: 'arne', series: 'mazariniCCG', amount: 5, rarity: ItemRarity.Common },
                { id: 'arne_caveman', series: 'mazariniCCG', amount: 5, rarity: ItemRarity.Common },
                { id: 'geggiexcited', series: 'mazariniCCG', amount: 2, rarity: ItemRarity.Common },
            ],
        },
        defaultCardback: 'standard',
        botDeck: {
            easy: {
                name: 'easy',
                active: true,
                valid: true,
                cards: [
                    { id: 'arne', series: 'mazariniCCG', amount: 5, rarity: ItemRarity.Common },
                    { id: 'arne_caveman', series: 'mazariniCCG', amount: 5, rarity: ItemRarity.Common },
                    { id: 'geggiexcited', series: 'mazariniCCG', amount: 2, rarity: ItemRarity.Common },
                ],
            },
            medium: {
                name: 'medium',
                active: true,
                valid: true,
                cards: [
                    { id: 'arne_caveman', series: 'mazariniCCG', amount: 2, rarity: ItemRarity.Common },
                    { id: 'shrekStare', series: 'mazariniCCG', amount: 2, rarity: ItemRarity.Common },
                    { id: 'geggiexcited', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Common },
                    { id: 'pointerbrothers1', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Epic },
                    { id: 'kms_gun', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Epic },
                    { id: 'geggi_kill', series: 'mazariniCCG', amount: 2, rarity: ItemRarity.Rare },
                    { id: 'the_chokester', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Rare },
                    { id: 'are_you', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Rare },
                    { id: 'maggiscared', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Rare },
                ],
            },
            hard: {
                name: 'hard',
                active: true,
                valid: true,
                cards: [
                    { id: 'shrekStare', series: 'mazariniCCG', amount: 2, rarity: ItemRarity.Common },
                    { id: 'pointerbrothers1', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Epic },
                    { id: 'kms_gun', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Epic },
                    { id: 'kys', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Legendary },
                    { id: 'geggi_kill', series: 'mazariniCCG', amount: 2, rarity: ItemRarity.Rare },
                    { id: 'choke_shield', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Rare },
                    { id: 'the_chokester', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Rare },
                    { id: 'hoie', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Legendary },
                    { id: 'are_you', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Rare },
                    { id: 'maggiscared', series: 'mazariniCCG', amount: 1, rarity: ItemRarity.Rare },
                ],
            },
        },
    },
}
