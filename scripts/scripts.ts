import { ApplicationEmojiManager } from 'discord.js'
import { MazariniClient } from '../client/MazariniClient'
import { mazariniCCG } from '../commands/ccg/cards/mazariniCCG'
import { swCCG } from '../commands/ccg/cards/swCCG'
import { ImageGenerationHelper } from '../helpers/imageGenerationHelper'
import {
    ICCGDeck,
    ILootbox,
    ILootSeries,
    ILootSeriesInventoryArt,
    ILootStats,
    ILootStatsColorCounter,
    ILuckyWheelReward,
    IPityTracker,
    ItemColor,
    ItemRarity,
    IUserLoot,
    IUserLootItem,
    IUserLootSeries,
    LootboxQuality,
    LuckyWheelRewardType,
    MazariniUser,
} from '../interfaces/database/databaseInterface'

export class Scripts {
    private client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }

    public setLuckyWheelRewards() {
        this.client.database.updateStorage({ luckyWheel: luckyWheelRewards })
    }

    public async prepareNewSeries() {
        const users = await this.client.database.getAllUsers()
        for (const user of users) {
            await this.refactorUserLoot(user)
        }
        // this.updateLootSeriesAndBoxes()
        const usersWithLoot = users.filter((user) => (user.collectables?.length ?? 0) > 0)
        for (const user of usersWithLoot) {
            await this.generateNewLootInventory(user)
            await this.setInventoryUrls(user)
        }
        await this.resetChipsAndPerks()
        this.client.database.saveDeathrollPot(0)
        this.client.cache.deathrollPot = 0
    }

    public async resetChipsAndPerks() {
        const users = await this.client.database.getAllUsers()
        for (const user of users) {
            user.effects = {
                positive: {},
                negative: {},
            }
            user.chips = 0
            user.daily = { ...user.daily, streak: 0, claimedToday: false }
            user.jail = { ...user.jail, daysInJail: 0, jailState: 'none' }
            await this.client.database.updateUser(user)
        }
    }

    public async makeRevealGif() {
        const igh = new ImageGenerationHelper(this.client)
        const allItems: gifTemplate[] = [
            ...common.map((i) => ({ ...i, rarity: ItemRarity.Common })),
            ...rare.map((i) => ({ ...i, rarity: ItemRarity.Rare })),
            ...epic.map((i) => ({ ...i, rarity: ItemRarity.Epic })),
            ...legendary.map((i) => ({ ...i, rarity: ItemRarity.Legendary })),
        ]
        for (const item of allItems) {
            console.log(item.rarity, ' - ', item.name)
            const lootItem = { name: item.name, series: 'lotr', rarity: item.rarity, color: ItemColor.None, amount: 1 }
            const reveal = await igh.generateRevealGifForCollectable(lootItem, item.background)
            this.client.database.uploadLootGif(`loot/lotr/${item.name}_none.webp`, reveal)
            // return new AttachmentBuilder(reveal, { name: 'reveal.webp' })
            // this.client.database.uploadLootGif(`loot/lotr/unobtainable.webp`, reveal)
        }
    }

    public async uploadLootApplicationEmojis() {
        const appEmoji: ApplicationEmojiManager = this.client.application.emojis
        const appEmojis = await appEmoji.fetch()
        const igh = new ImageGenerationHelper(this.client)
        const allItems: gifTemplate[] = [
            ...common.map((i) => ({ ...i, rarity: ItemRarity.Common })),
            ...rare.map((i) => ({ ...i, rarity: ItemRarity.Rare })),
            ...epic.map((i) => ({ ...i, rarity: ItemRarity.Epic })),
            ...legendary.map((i) => ({ ...i, rarity: ItemRarity.Legendary })),
        ]
        for (const item of allItems) {
            console.log(item.rarity, ' - ', item.name)
            const name = `lotr_${item.name}_n` // Change for CCG
            const emojiObj = appEmojis.find((emoji) => emoji.name == name)
            if (!emojiObj) {
                const lootItem = { name: item.name, series: 'lotr', rarity: item.rarity, color: ItemColor.None, amount: 1 }
                const emoji = await igh.makeApplicationEmoji(lootItem)
                appEmoji.create({ name: name, attachment: emoji })
            }
        }
    }

    public async updateLootSeriesAndPacks() {
        const packs = (await this.client.database.getLootpacks()) ?? new Array<ILootbox>()
        if (!packs.some((pack) => pack.name === basicLootPack.name)) packs.push(basicLootPack)
        this.client.database.setLootpacks(packs)
        const allSeries = await this.client.database.getLootboxSeries()
        if (!allSeries.some((series) => series.name === mazariniCCG_series.name)) allSeries.push(mazariniCCG_series)
        if (!allSeries.some((series) => series.name === swCCG_series.name)) allSeries.push(swCCG_series)
        this.client.database.setLootSeries(allSeries)
    }

    public setLootPacks() {
        this.client.database.setLootpacks([basicLootPack, premiumLootPack])
    }

    public setCCGCards() {
        this.client.database.updateStorage({
            ccg: {
                mazariniCCG: mazariniCCG,
                swCCG: swCCG,
            },
        })
    }

    public updateCCGSeries() {
        this.setCCGCards()
        this.client.database.updateLootboxSeries(mazariniCCG_series)
        this.client.database.updateLootboxSeries(swCCG_series)
    }

    public async refactorUserLoot(user: MazariniUser) {
        const mazarini: IUserLootSeries = {
            name: 'mazarini',
            inventoryArt: undefined,
            pityLevel: structuredClone(defaultPityLevel),
            inventory: structuredClone(defaultInventory),
            stats: structuredClone(defaultLootStats),
        }
        const sw: IUserLootSeries = {
            name: 'sw',
            inventoryArt: undefined,
            pityLevel: structuredClone(defaultPityLevel),
            inventory: structuredClone(defaultInventory),
            stats: structuredClone(defaultLootStats),
        }
        const hp: IUserLootSeries = {
            name: 'hp',
            inventoryArt: undefined,
            pityLevel: structuredClone(defaultPityLevel),
            inventory: structuredClone(defaultInventory),
            stats: structuredClone(defaultLootStats),
        }
        const lotr: IUserLootSeries = {
            name: 'lotr',
            inventoryArt: undefined,
            pityLevel: structuredClone(defaultPityLevel),
            inventory: structuredClone(defaultInventory),
            stats: structuredClone(defaultLootStats),
        }
        const mazariniCCG: IUserLootSeries = {
            name: 'mazariniCCG',
            pityLevel: user.loot.mazariniCCG?.pityLevel ?? structuredClone(defaultPityLevel),
            inventory: user.loot.mazariniCCG?.inventory ?? structuredClone(defaultInventory),
            stats: user.loot.mazariniCCG?.stats ?? structuredClone(defaultLootStats),
        }
        const loot: IUserLoot = { mazarini: mazarini, sw: sw, hp: hp, lotr: lotr, mazariniCCG: mazariniCCG }
        if (user.collectables) {
            for (const item of user.collectables) {
                loot[item.series]['inventory'][item.rarity]['items'].push(item)
            }
        }
        user.loot = loot
        await this.client.database.updateUser(user)
    }

    public async initializeNewInventories() {
        const users = (await this.client.database.getAllUsers()).filter((user) => (user.collectables?.length ?? 0) > 0)
        for (const user of users) {
            const mazariniCCG: IUserLootSeries = {
                name: 'mazariniCCG',
                pityLevel: user.loot.mazariniCCG?.pityLevel ?? structuredClone(defaultPityLevel),
                inventory: user.loot.mazariniCCG?.inventory ?? structuredClone(defaultInventory),
                stats: user.loot.mazariniCCG?.stats ?? structuredClone(defaultLootStats),
            }
            mazariniCCG.inventory.common.items = startingInventory
            // user.loot = {...user.loot, mazariniCCG: mazariniCCG}
            user.loot.mazariniCCG = mazariniCCG
            user.ccg = { ...user.ccg, decks: [startingDeck] }
            await this.client.database.updateUser(user)
        }
    }

    public async generateNewLootInventory(user: MazariniUser) {
        const seriess = await this.client.database.getLootboxSeries()
        const imgGen = new ImageGenerationHelper(this.client)
        for (const series of seriess) {
            if (series.name === 'lotr') {
                const common = await imgGen.generateImageForCollectablesRarity(user, series, ItemRarity.Common)
                this.client.database.uploadUserInventory(user, `${series.name}/common.png`, common)

                const rare = await imgGen.generateImageForCollectablesRarity(user, series, ItemRarity.Rare)
                this.client.database.uploadUserInventory(user, `${series.name}/rare.png`, rare)

                const epic = await imgGen.generateImageForCollectablesRarity(user, series, ItemRarity.Epic)
                this.client.database.uploadUserInventory(user, `${series.name}/epic.png`, epic)

                const legendary = await imgGen.generateImageForCollectablesRarity(user, series, ItemRarity.Legendary)
                this.client.database.uploadUserInventory(user, `${series.name}/legendary.png`, legendary)
            }
        }
    }

    public async uploadInventoryArts() {
        const series = (await this.client.database.getLootboxSeries()).find((serie) => serie.name === 'lotr')
        series.inventoryArts = lotrInventoryArts
        this.client.database.updateLootboxSeries(series)
    }

    public async setInventoryUrls(user: MazariniUser) {
        for (const series of ['mazarini', 'sw', 'hp', 'lotr']) {
            const commonUrl = await this.client.database.getUserInventory(user, series, ItemRarity.Common)
            user.loot[series]['inventory']['common']['img'] = commonUrl

            const rareUrl = await this.client.database.getUserInventory(user, series, ItemRarity.Rare)
            user.loot[series]['inventory']['rare']['img'] = rareUrl

            const epicUrl = await this.client.database.getUserInventory(user, series, ItemRarity.Epic)
            user.loot[series]['inventory']['epic']['img'] = epicUrl

            const legendaryUrl = await this.client.database.getUserInventory(user, series, ItemRarity.Legendary)
            user.loot[series]['inventory']['legendary']['img'] = legendaryUrl

            this.client.database.updateUser(user)
        }
    }
}

const defaultInventory = {
    common: { img: '', items: new Array<IUserLootItem>() },
    rare: { img: '', items: new Array<IUserLootItem>() },
    epic: { img: '', items: new Array<IUserLootItem>() },
    legendary: { img: '', items: new Array<IUserLootItem>() },
}

const defaultPityLevel: IPityTracker = {
    level: 0,
    consequtiveDuplicates: 0,
    chipsSinceNonDuplicate: 0,
}

const lootColorStats: ILootStatsColorCounter = {
    none: 0,
    silver: 0,
    gold: 0,
    diamond: 0,
}

const defaultLootStats: ILootStats = {
    chipsSpent: 0,
    chestsOpened: {
        basic: 0,
        premium: 0,
        elite: 0,
        special: 0,
    },
    boxesOpened: {
        basic: 0,
        premium: 0,
        elite: 0,
        special: 0,
    },
    rarities: {
        common: structuredClone(lootColorStats),
        rare: structuredClone(lootColorStats),
        epic: structuredClone(lootColorStats),
        legendary: structuredClone(lootColorStats),
    },
    trades: {
        in: 0,
        up: 0,
    },
    achievements: {
        daysWithUnobtainable: 0,
    },
}

const mazariniCCG_series: ILootSeries = {
    name: 'mazariniCCG',
    added: new Date(),
    common: ['shrekStare', 'geggiexcited', 'arne', 'arne_caveman'],
    rare: ['the_chokester', 'maggiscared', 'sniff', 'are_you', 'kms2', 'yarrne', 'geggi_kill', 'choke_shield', 'turtle', 'waiting', 'catmygling'],
    epic: ['pointerbrothers1', 'same', 'KEKW_gun', 'kms_gun', 'arnenymous', 'polse', 'eivindpride'],
    legendary: ['kys', 'hoie'],
    hasColor: false,
    hasUnobtainable: false,
    isCCG: true,
}

const swCCG_series: ILootSeries = {
    name: 'swCCG',
    added: new Date(),
    common: ['sw_battle_droid_n', 'sw_gonk_droid_n', 'sw_darth_maul_n', 'sw_jarjar_n'],
    rare: ['sw_general_grevious_n', 'sw_han_solo_n', 'sw_mace_windu_n'],
    epic: ['sw_storm_trooper_n', 'sw_yoda_n', 'sw_padme_amidala_n', 'sw_princess_leia_n'],
    legendary: ['sw_space_jesus_n', 'sw_qui_gon_jinn_n', 'sw_luke_skywalker_n'],
    hasColor: false,
    hasUnobtainable: false,
    isCCG: true,
}

const lotr_series: ILootSeries = {
    name: 'lotr',
    added: new Date(),
    common: [
        'barlinman_butterbur',
        'pj_cameo',
        'grima_wormtongue',
        'sharku',
        'ugluk',
        'elven_brooch',
        'lembas_bread',
        'bag_end',
        'meduseld',
        'gondor_shield',
        'shagrat',
        'elven_shield',
        'brego',
        'gamling',
        'hama',
        'farmer_maggot',
        'gaffer_gamgee',
        'l_s_baggins',
        'odo_proudfoot',
        'rosie_cotton',
    ],
    rare: [
        'grond',
        'king_of_the_dead',
        'grishnakh',
        'snaga',
        'treebeard',
        'haldir',
        'argonath',
        'black_gate',
        'minas_morgul',
        'eighth_nazgul',
        'fell_beast',
        'gothmog',
        'ninth_nazgul',
        'seventh_nazgul',
        'sixth_nazgul',
        'crown_of_gondor',
        'horn_of_gondor',
        'gorbag',
        'sting',
        'eowyn',
    ],
    epic: [
        'gandalf_the_gray',
        'lurtz',
        'palantir',
        'celeborn',
        'light_of_earendil',
        'helms_deep',
        'mount_doom',
        'orthanc',
        'fifth_nazgul',
        'fourth_nazgul',
        'second_nazgul',
        'third_nazgul',
        'denethor',
        'isildur',
        'shelob',
        'balrog',
        'arwen',
        'shards_of_narsil',
        'eomer',
        'bilbo',
    ],
    legendary: [
        'aragorn',
        'boromir',
        'gandalf_the_white',
        'gimli',
        'legolas',
        'frodo',
        'merry',
        'pippin',
        'samwise',
        'anduril',
        'saruman',
        'galadriel',
        'barad_dur',
        'witch_king',
        'faramir',
        'staff_of_gandalf',
        'sauron',
        'gollum',
        'elrond',
        'theoden',
    ],
    hasColor: false,
    hasUnobtainable: false,
    unobtainableHolder: '',
}

export interface gifTemplate {
    name: string
    rarity?: ItemRarity
    background: string
}

const common: gifTemplate[] = [
    { name: 'barlinman_butterbur', background: 'bree' },
    { name: 'pj_cameo', background: 'bree' },
    { name: 'grima_wormtongue', background: 'isengard' },
    { name: 'sharku', background: 'isengard' },
    { name: 'ugluk', background: 'isengard' },
    { name: 'elven_brooch', background: 'lothlorien' },
    { name: 'lembas_bread', background: 'lothlorien' },
    { name: 'bag_end', background: 'middle_earth' },
    { name: 'meduseld', background: 'middle_earth' },
    { name: 'gondor_shield', background: 'minas_tirith' },
    { name: 'shagrat', background: 'mordor' },
    { name: 'elven_shield', background: 'rivendell' },
    { name: 'brego', background: 'rohan' },
    { name: 'gamling', background: 'rohan' },
    { name: 'hama', background: 'rohan' },
    { name: 'farmer_maggot', background: 'shire' },
    { name: 'gaffer_gamgee', background: 'shire' },
    { name: 'l_s_baggins', background: 'shire' },
    { name: 'odo_proudfoot', background: 'shire' },
    { name: 'rosie_cotton', background: 'shire' },
]

const rare: gifTemplate[] = [
    { name: 'grond', background: 'minas_morgul' },
    { name: 'king_of_the_dead', background: 'dunharrow' },
    { name: 'grishnakh', background: 'isengard' },
    { name: 'snaga', background: 'isengard' },
    { name: 'treebeard', background: 'isengard' },
    { name: 'haldir', background: 'lothlorien' },
    { name: 'argonath', background: 'middle_earth' },
    { name: 'black_gate', background: 'middle_earth' },
    { name: 'minas_morgul', background: 'middle_earth' },
    { name: 'eight_nazgul', background: 'minas_morgul' },
    { name: 'fell_beast', background: 'minas_morgul' },
    { name: 'gothmog', background: 'minas_morgul' },
    { name: 'ninth_nazgul', background: 'minas_morgul' },
    { name: 'seventh_nazgul', background: 'minas_morgul' },
    { name: 'sixth_nazgul', background: 'minas_morgul' },
    { name: 'crown_of_gondor', background: 'minas_tirith' },
    { name: 'horn_of_gondor', background: 'minas_tirith' },
    { name: 'gorbag', background: 'mordor' },
    { name: 'sting', background: 'rivendell' },
    { name: 'eowyn', background: 'rohan' },
]

const epic: gifTemplate[] = [
    { name: 'gandalf_the_gray', background: 'council_of_elrond' },
    { name: 'lurtz', background: 'isengard' },
    { name: 'palantir', background: 'isengard' },
    { name: 'celeborn', background: 'lothlorien' },
    { name: 'light_of_earendil', background: 'lothlorien' },
    { name: 'helms_deep', background: 'middle_earth' },
    { name: 'mount_doom', background: 'middle_earth' },
    { name: 'orthanc', background: 'middle_earth' },
    { name: 'fifth_nazgul', background: 'minas_morgul' },
    { name: 'fourth_nazgul', background: 'minas_morgul' },
    { name: 'second_nazgul', background: 'minas_morgul' },
    { name: 'third_nazgul', background: 'minas_morgul' },
    { name: 'denethor', background: 'minas_tirith' },
    { name: 'isildur', background: 'mordor' },
    { name: 'shelob', background: 'mordor' },
    { name: 'balrog', background: 'moria' },
    { name: 'arwen', background: 'rivendell' },
    { name: 'shards_of_narsil', background: 'rivendell' },
    { name: 'eomer', background: 'rohan' },
    { name: 'bilbo', background: 'shire' },
]

const legendary: gifTemplate[] = [
    { name: 'aragorn', background: 'council_of_elrond' },
    { name: 'boromir', background: 'council_of_elrond' },
    { name: 'gandalf_the_white', background: 'council_of_elrond' },
    { name: 'gimli', background: 'council_of_elrond' },
    { name: 'legolas', background: 'council_of_elrond' },
    { name: 'frodo', background: 'council_of_elrond' },
    { name: 'merry', background: 'council_of_elrond' },
    { name: 'pippin', background: 'council_of_elrond' },
    { name: 'samwise', background: 'council_of_elrond' },
    { name: 'anduril', background: 'dunharrow' },
    { name: 'saruman', background: 'isengard' },
    { name: 'galadriel', background: 'lothlorien' },
    { name: 'barad_dur', background: 'middle_earth' },
    { name: 'witch_king', background: 'minas_morgul' },
    { name: 'faramir', background: 'minas_tirith' },
    { name: 'staff_of_gandalf', background: 'minas_tirith' },
    { name: 'sauron', background: 'mordor' },
    { name: 'gollum', background: 'mordor' },
    { name: 'elrond', background: 'rivendell' },
    { name: 'theoden', background: 'rohan' },
]

const unobtainable: gifTemplate = { name: 'the_one_ring', background: 'black_texture' }

const lotrInventoryArts: ILootSeriesInventoryArt[] = [
    { name: 'Argonath', opacity: 0.5 },
    { name: 'Black_Gate', opacity: 0.5 },
    { name: 'Gandalf_vs_Balrog', opacity: 0.5 },
    { name: 'Helms_Deep', opacity: 0.5 },
    { name: 'Minas_Tirith', opacity: 0.5 },
    { name: 'Mount_Doom', opacity: 0.5 },
    { name: 'Nazgul', opacity: 0.5 },
    { name: 'Sauron', opacity: 0.5 },
    { name: 'Shire_dark', opacity: 0.5 },
    { name: 'Shire_light', opacity: 0.5 },
    { name: 'Two_Towers', opacity: 0.5 },
    { name: 'Witch_King', opacity: 0.5 },
]

const luckyWheelRewards: ILuckyWheelReward[] = [
    { name: '10K Dond', type: LuckyWheelRewardType.dond, amount: 10, weight: 4 },
    { name: '20K Dond', type: LuckyWheelRewardType.dond, amount: 20, weight: 3 },
    { name: '50K Dond', type: LuckyWheelRewardType.dond, amount: 50, weight: 2 },
    {
        name: 'Basic Pack',
        type: LuckyWheelRewardType.pack,
        quality: LootboxQuality.Basic,
        weight: 1,
    },
    {
        name: '500 chips',
        type: LuckyWheelRewardType.chips,
        amount: 500,
        weight: 4,
    },
    {
        name: '1000 chips',
        type: LuckyWheelRewardType.chips,
        amount: 1000,
        weight: 4,
    },
    {
        name: '1500 chips',
        type: LuckyWheelRewardType.chips,
        amount: 1500,
        weight: 4,
    },
    {
        name: '2000 chips',
        type: LuckyWheelRewardType.chips,
        amount: 2000,
        weight: 4,
    },
    {
        name: '2500 chips',
        type: LuckyWheelRewardType.chips,
        amount: 2500,
        weight: 4,
    },
    {
        name: '3000 chips',
        type: LuckyWheelRewardType.chips,
        amount: 3000,
        weight: 4,
    },
    {
        name: '3500 chips',
        type: LuckyWheelRewardType.chips,
        amount: 3500,
        weight: 4,
    },
    {
        name: '4000 chips',
        type: LuckyWheelRewardType.chips,
        amount: 4000,
        weight: 4,
    },
    {
        name: '4500 chips',
        type: LuckyWheelRewardType.chips,
        amount: 4500,
        weight: 4,
    },
    {
        name: '5000 chips',
        type: LuckyWheelRewardType.chips,
        amount: 5000,
        weight: 4,
    },
]

const basicLootPack: ILootbox = {
    name: 'basic',
    price: 50,
    probabilities: {
        common: 1,
        rare: 0.86,
        epic: 0.11,
        legendary: 0.01,
        color: 0,
    },
    isCCG: true,
    rewardOnly: false,
}

const premiumLootPack: ILootbox = {
    name: 'premium',
    price: 75,
    probabilities: {
        common: 1,
        rare: 1,
        epic: 0.22,
        legendary: 0.02,
        color: 0,
    },
    isCCG: true,
    rewardOnly: false,
}

const startingInventory: IUserLootItem[] = [
    { name: 'arne', color: ItemColor.None, series: 'mazariniCCG', amount: 5, isCCG: true, rarity: ItemRarity.Common },
    { name: 'arne_caveman', color: ItemColor.None, series: 'mazariniCCG', amount: 5, isCCG: true, rarity: ItemRarity.Common },
    { name: 'geggiexcited', color: ItemColor.None, series: 'mazariniCCG', amount: 2, isCCG: true, rarity: ItemRarity.Common },
]

const startingDeck: ICCGDeck = {
    name: 'default',
    active: true,
    valid: true,
    cards: [
        { id: 'arne', series: 'mazariniCCG', amount: 5 },
        { id: 'arne_caveman', series: 'mazariniCCG', amount: 5 },
        { id: 'geggiexcited', series: 'mazariniCCG', amount: 2 },
    ],
}
