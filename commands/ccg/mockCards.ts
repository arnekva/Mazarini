import { ItemRarity } from '../../interfaces/database/databaseInterface'
import { CCGCard, CCGCardType } from './ccgInterface'

export const kingH = 'https://opengameart.org/sites/default/files/king_of_hearts2.png'
export const sevenC = 'https://opengameart.org/sites/default/files/7_of_clubs.png'
export const queenD = 'https://opengameart.org/sites/default/files/queen_of_diamonds2.png'

export const mocKing: CCGCard = {
    id: 'mock_king',
    name: 'King of Hearts',
    series: 'mazariniCCG',
    type: CCGCardType.Shield,
    effects: [
        {
            target: 'OPPONENT',
            type: 'DAMAGE',
            value: 5,
        },
    ],
    cost: 5,
    rarity: ItemRarity.Rare,
    accuracy: 90,
    speed: 20,
    typeValue: 13,
    imageUrl: kingH,
    emoji: '<:KH:1106557557222416444>',
}

export const mocQueen: CCGCard = {
    id: 'mock_queen',
    name: 'Queen of Diamonds',
    series: 'mazariniCCG',
    type: CCGCardType.Attack,
    effects: [
        {
            target: 'SELF',
            type: 'DAMAGE',
            value: 1,
        },
        {
            target: 'OPPONENT',
            type: 'DAMAGE',
            value: 2,
        },
    ],
    cost: 1,
    rarity: ItemRarity.Rare,
    accuracy: 95,
    speed: 31,
    typeValue: 12,
    imageUrl: queenD,
    emoji: '<:QD:1106557466025664584>',
}

export const mock7: CCGCard = {
    id: 'mock_seven',
    name: 'Seven of Clubs',
    series: 'mazariniCCG',
    type: CCGCardType.Effect,
    effects: [
        {
            target: 'SELF',
            type: 'HEAL',
            value: 1,
        },
    ],
    cost: 1,
    rarity: ItemRarity.Common,
    accuracy: 100,
    speed: 19,
    typeValue: 7,
    imageUrl: sevenC,
    emoji: '<:7C:1106555304654680166>',
}

export const mocKing_2: CCGCard = {
    id: 'mock_king_2',
    name: 'King of Hearts 2',
    series: 'mazariniCCG',
    type: CCGCardType.Shield,
    effects: [
        {
            target: 'OPPONENT',
            type: 'DAMAGE',
            value: 5,
        },
    ],
    cost: 5,
    rarity: ItemRarity.Rare,
    accuracy: 90,
    speed: 20,
    typeValue: 13,
    imageUrl: kingH,
    emoji: '<:KH:1106557557222416444>',
}

export const mocQueen_2: CCGCard = {
    id: 'mock_queen_2',
    name: 'Queen of Diamonds 2',
    series: 'mazariniCCG',
    type: CCGCardType.Attack,
    effects: [
        {
            target: 'SELF',
            type: 'DAMAGE',
            value: 1,
        },
        {
            target: 'OPPONENT',
            type: 'DAMAGE',
            value: 2,
        },
    ],
    cost: 1,
    rarity: ItemRarity.Rare,
    accuracy: 95,
    speed: 31,
    typeValue: 12,
    imageUrl: queenD,
    emoji: '<:QD:1106557466025664584>',
}

export const mock7_2: CCGCard = {
    id: 'mock_seven_2',
    name: 'Seven of Clubs 2',
    series: 'mazariniCCG',
    type: CCGCardType.Effect,
    effects: [
        {
            target: 'SELF',
            type: 'HEAL',
            value: 1,
        },
    ],
    cost: 1,
    rarity: ItemRarity.Common,
    accuracy: 100,
    speed: 19,
    typeValue: 7,
    imageUrl: sevenC,
    emoji: '<:7C:1106555304654680166>',
}

export const mockCards: CCGCard[] = [mocKing, mocQueen, mock7]

export const mockHand: CCGCard[] = [
    {
        id: 'kingH-1',
        name: 'First King',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'OPPONENT',
                type: 'DAMAGE',
                value: 5,
            },
        ],
        cost: 5,
        rarity: ItemRarity.Common,
        accuracy: 30,
        speed: 20,
        typeValue: 13,
        imageUrl: kingH,
        emoji: '<:KH:1106557557222416444>',
    },
    {
        id: 'kingH-2',
        name: 'Second King',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'SHIELD',
                value: 2,
                turns: 10,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Rare,
        accuracy: 50,
        speed: 25,
        typeValue: 13,
        imageUrl: kingH,
        emoji: '<:KH:1106557557222416444>',
    },
    {
        id: 'kingH-3',
        name: 'Third King',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'REFLECT',
                turns: 1,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Epic,
        accuracy: 70,
        speed: 40,
        typeValue: 13,
        imageUrl: kingH,
        emoji: '<:KH:1106557557222416444>',
    },
    {
        id: 'kingH-4',
        name: 'Fourth King',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'GAIN_ENERGY',
                value: 1,
                turns: 20,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Legendary,
        accuracy: 90,
        speed: 23,
        typeValue: 13,
        imageUrl: kingH,
        emoji: '<:KH:1106557557222416444>',
    },

    {
        id: 'sevenC-1',
        name: 'First 7',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'HEAL',
                value: 1,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Common,
        accuracy: 100,
        speed: 19,
        typeValue: 7,
        imageUrl: sevenC,
        emoji: '<:7C:1106555304654680166>',
    },
    {
        id: 'sevenC-2',
        name: 'Second 7',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'HEAL',
                value: 1,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Rare,
        accuracy: 100,
        speed: 18,
        typeValue: 7,
        imageUrl: sevenC,
        emoji: '<:7C:1106555304654680166>',
    },
    {
        id: 'sevenC-3',
        name: 'Third 7',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'HEAL',
                value: 1,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Epic,
        accuracy: 100,
        speed: 15,
        typeValue: 7,
        imageUrl: sevenC,
        emoji: '<:7C:1106555304654680166>',
    },
    {
        id: 'sevenC-4',
        name: 'Fourth 7',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'HEAL',
                value: 1,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Legendary,
        accuracy: 100,
        speed: 16,
        typeValue: 7,
        imageUrl: sevenC,
        emoji: '<:7C:1106555304654680166>',
    },

    {
        id: 'queenD-1',
        name: 'First Queen',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'DAMAGE',
                value: 1,
            },
            {
                target: 'OPPONENT',
                type: 'DAMAGE',
                value: 2,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Common,
        accuracy: 95,
        speed: 31,
        typeValue: 12,
        imageUrl: queenD,
        emoji: '<:QD:1106557466025664584>',
    },
    {
        id: 'queenD-2',
        name: 'Second Queen',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'DAMAGE',
                value: 1,
            },
            {
                target: 'OPPONENT',
                type: 'DAMAGE',
                value: 2,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Rare,
        accuracy: 95,
        speed: 34,
        typeValue: 12,
        imageUrl: queenD,
        emoji: '<:QD:1106557466025664584>',
    },
    {
        id: 'queenD-3',
        name: 'Third Queen',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'DAMAGE',
                value: 1,
            },
            {
                target: 'OPPONENT',
                type: 'DAMAGE',
                value: 2,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Epic,
        accuracy: 95,
        speed: 37,
        typeValue: 12,
        imageUrl: queenD,
        emoji: '<:QD:1106557466025664584>',
    },
    {
        id: 'queenD-4',
        name: 'Fourth Queen',
        series: 'mazariniCCG',
        type: CCGCardType.Attack,
        effects: [
            {
                target: 'SELF',
                type: 'DAMAGE',
                value: 1,
            },
            {
                target: 'OPPONENT',
                type: 'DAMAGE',
                value: 2,
            },
        ],
        cost: 1,
        rarity: ItemRarity.Legendary,
        accuracy: 95,
        speed: 36,
        typeValue: 12,
        imageUrl: queenD,
        emoji: '<:QD:1106557466025664584>',
    },
]
