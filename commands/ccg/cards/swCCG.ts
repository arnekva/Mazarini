import { ItemRarity } from '../../../interfaces/database/databaseInterface'
import { CCGCard, CCGCardType } from '../ccgInterface'

export const swCCG: CCGCard[] = [
    {
        id: 'sw_battle_droid_n',
        name: 'Battle Droid',
        series: 'swCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                type: 'DAMAGE',
                target: 'OPPONENT',
                value: 1,
            },
        ],
        cost: 0,
        speed: 40,
        rarity: ItemRarity.Common,
        accuracy: 95,
    },
    {
        id: 'sw_gonk_droid_n',
        name: 'Gonk Droid',
        series: 'swCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                type: 'DAMAGE',
                target: 'OPPONENT',
                value: 2,
            },
            {
                type: 'DAMAGE',
                target: 'SELF',
                value: 2,
            },
        ],
        cost: 0,
        speed: 30,
        rarity: ItemRarity.Common,
        accuracy: 90,
    },

    {
        id: 'sw_jarjar_n',
        name: 'Jar Jar Binks',
        series: 'swCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                type: 'DAMAGE',
                target: 'OPPONENT',
                value: 4,
            },
            {
                // applies RETARDED to self for 1 turn (turns - 1 displayed)
                type: 'RETARDED',
                target: 'SELF',
                turns: 2,
                statusAccuracy: 100,
            },
        ],
        cost: 1,
        speed: 35,
        rarity: ItemRarity.Common,
        accuracy: 80,
    },
    // ── RARE ─────────────────────────────────────────────────────────────────
    {
        id: 'sw_general_grevious_n',
        name: 'General Grievous',
        series: 'swCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                type: 'DAMAGE',
                target: 'OPPONENT',
                value: 1,
            },
            {
                type: 'BLEED',
                target: 'OPPONENT',
                value: 1,
                turns: 2,
            },
            {
                type: 'BLEED',
                target: 'OPPONENT',
                value: 1,
                turns: 2,
            },
        ],
        cost: 3,
        speed: 30,
        rarity: ItemRarity.Rare,
        accuracy: 90,
    },
    {
        id: 'sw_han_solo_n',
        name: 'Han Solo',
        series: 'swCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                type: 'DAMAGE',
                target: 'OPPONENT',
                value: 1,
            },
            {
                // +50% speed for 2 turns
                type: 'SPEED_BUFF',
                target: 'SELF',
                turns: 3,
            },
        ],
        cost: 1,
        speed: 55,
        rarity: ItemRarity.Rare,
        accuracy: 90,
    },
    {
        id: 'sw_mace_windu_n',
        name: 'Mace Windu',
        series: 'swCCG',
        type: CCGCardType.Heal,
        effects: [
            {
                type: 'RECOVER',
                target: 'SELF',
                value: 2,
                turns: 2,
            },
        ],
        cost: 0,
        speed: 10,
        rarity: ItemRarity.Rare,
        accuracy: 100,
        cannotMiss: true,
    },
    {
        // Special card – copies opponent's LOWEST cost played card (handled in checkForSpecialCards)
        id: 'sw_storm_trooper_n',
        name: 'Storm Trooper',
        series: 'swCCG',
        type: CCGCardType.Effect,
        effects: [],
        cost: 1,
        speed: 1,
        rarity: ItemRarity.Rare,
        accuracy: 90,
    },
    // ── EPIC ─────────────────────────────────────────────────────────────────
    {
        id: 'sw_darth_maul_n',
        name: 'Darth Maul',
        series: 'swCCG',
        type: CCGCardType.Effect,
        effects: [
            {
                type: 'SLOW',
                target: 'OPPONENT',
                turns: 2,
            },
            {
                type: 'CHOKESTER',
                target: 'OPPONENT',
                turns: 2,
            },
        ],
        cost: 2,
        speed: 50,
        rarity: ItemRarity.Epic,
        accuracy: 100,
        cannotMiss: true,
    },
    {
        id: 'sw_yoda_n',
        name: 'Yoda',
        series: 'swCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                type: 'DAMAGE',
                target: 'OPPONENT',
                value: 2,
            },
            {
                // SLOW for 1 turn (turns - 1 displayed)
                type: 'SLOW',
                target: 'OPPONENT',
                turns: 2,
            },
        ],
        cost: 2,
        speed: 20,
        rarity: ItemRarity.Epic,
        accuracy: 85,
    },
    {
        id: 'sw_padme_amidala_n',
        name: 'Padme Amidala',
        series: 'swCCG',
        type: CCGCardType.Effect,
        effects: [
            {
                // REDUCE_COST 1 for 1 turn (turns - 1 displayed) for ALL players
                type: 'REDUCE_COST',
                target: 'SELF',
                value: 1,
                turns: 2,
            },
            {
                type: 'REDUCE_COST',
                target: 'OPPONENT',
                value: 1,
                turns: 2,
            },
        ],
        cost: 0,
        speed: 8,
        rarity: ItemRarity.Epic,
        accuracy: 100,
        cannotMiss: true,
    },
    {
        id: 'sw_princess_leia_n',
        name: 'Princess Leia',
        series: 'swCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                type: 'DAMAGE',
                target: 'OPPONENT',
                value: 1,
            },
            {
                type: 'HEAL',
                target: 'SELF',
                value: 3,
            },
        ],
        cost: 1,
        speed: 66,
        rarity: ItemRarity.Epic,
        accuracy: 90,
    },
    // ── LEGENDARY ─────────────────────────────────────────────────────────────
    {
        id: 'sw_space_jesus_n',
        name: 'Space Jesus',
        series: 'swCCG',
        type: CCGCardType.Effect,
        effects: [
            {
                // Next turn, +2 to all damage (turns: 2 → ticks once this turn, active next turn)
                type: 'DAMAGE_BOOST',
                target: 'SELF',
                value: 2,
                turns: 2,
            },
        ],
        cost: 2,
        speed: 15,
        rarity: ItemRarity.Legendary,
        accuracy: 100,
        cannotMiss: true,
    },
    {
        id: 'sw_qui_gon_jinn_n',
        name: 'Qui-Gon Jinn',
        series: 'swCCG',
        type: CCGCardType.Effect,
        effects: [
            {
                // Play 3 cards next turn (turns: 2 → ticks once this turn, active next turn)
                type: 'EXTRA_CARDS',
                target: 'SELF',
                value: 3,
                turns: 2,
            },
        ],
        cost: 2,
        speed: 5,
        rarity: ItemRarity.Legendary,
        accuracy: 100,
        cannotMiss: true,
    },
    {
        id: 'sw_luke_skywalker_n',
        name: 'Luke Skywalker',
        series: 'swCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                type: 'DAMAGE',
                target: 'OPPONENT',
                value: 3,
            },
            {
                type: 'HEAL',
                target: 'SELF',
                value: 4,
            },
        ],
        cost: 3,
        speed: 60,
        rarity: ItemRarity.Legendary,
        accuracy: 90,
    },
]
