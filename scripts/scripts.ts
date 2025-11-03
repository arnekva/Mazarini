import { ApplicationEmojiManager } from 'discord.js'
import { MazariniClient } from '../client/MazariniClient'
import { ImageGenerationHelper } from '../helpers/imageGenerationHelper'
import {
    ILootSeries,
    ILootSeriesInventoryArt,
    ILootStats,
    ILootStatsColorCounter,
    IPityTracker,
    ItemColor,
    ItemRarity,
    IUserLoot,
    IUserLootItem,
    IUserLootSeries,
    MazariniUser,
} from '../interfaces/database/databaseInterface'

export class Scripts {
    private client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }

    public async prepareNewSeries() {
        const users = await this.client.database.getAllUsers()
        for (const user of users) {
            await this.refactorUserLoot(user)
        }
        this.updateLootSeriesAndBoxes()
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
        const allItems: gifTemplate[] = [...common, ...rare, ...epic, ...legendary]
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
        const allItems: gifTemplate[] = [...common, ...rare, ...epic, ...legendary]
        for (const item of allItems) {
            console.log(item.rarity, ' - ', item.name)
            const name = `lotr_${item.name}_n`
            const emojiObj = appEmojis.find((emoji) => emoji.name == name)
            if (!emojiObj) {
                const lootItem = { name: item.name, series: 'lotr', rarity: item.rarity, color: ItemColor.None, amount: 1 }
                const emoji = await igh.makeApplicationEmoji(lootItem)
                appEmoji.create({ name: name, attachment: emoji })
            }
        }
    }

    public async updateLootSeriesAndBoxes() {
        const boxes = await this.client.database.getLootboxes()
        const updatedBoxes = boxes.map((box) => ({ ...box, probabilities: { ...box.probabilities, unobtainable: 0.002 } }))
        this.client.database.setLootboxes(updatedBoxes)
        const allSeries = await this.client.database.getLootboxSeries()
        const updatedSeries = allSeries.map((series) => ({ ...series, hasColor: true, hasUnobtainable: false }))
        if (!updatedSeries.some((series) => series.name === lotr_series.name)) updatedSeries.push(lotr_series)
        this.client.database.setLootSeries(updatedSeries)
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
        const loot: IUserLoot = { mazarini: mazarini, sw: sw, hp: hp, lotr: lotr }
        if (user.collectables) {
            for (const item of user.collectables) {
                loot[item.series]['inventory'][item.rarity]['items'].push(item)
            }
        }
        user.loot = loot
        await this.client.database.updateUser(user)
    }

    public async refactorUserLootArt() {
        const users = await this.client.database.getAllUsers()
        for (const user of users) {
            const lotr: IUserLootSeries = {
                name: 'lotr',
                inventoryArt: undefined,
                pityLevel: user.loot.lotr.pityLevel ?? structuredClone(defaultPityLevel),
                inventory: user.loot.lotr.inventory ?? structuredClone(defaultInventory),
                stats: user.loot.lotr.stats ?? structuredClone(defaultLootStats),
            }
            user.loot.lotr = lotr
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
    rarity: ItemRarity
    background: string
}

const common: gifTemplate[] = [
    { name: 'barlinman_butterbur', background: 'bree', rarity: ItemRarity.Common },
    { name: 'pj_cameo', background: 'bree', rarity: ItemRarity.Common },
    { name: 'grima_wormtongue', background: 'isengard', rarity: ItemRarity.Common },
    { name: 'sharku', background: 'isengard', rarity: ItemRarity.Common },
    { name: 'ugluk', background: 'isengard', rarity: ItemRarity.Common },
    { name: 'elven_brooch', background: 'lothlorien', rarity: ItemRarity.Common },
    { name: 'lembas_bread', background: 'lothlorien', rarity: ItemRarity.Common },
    { name: 'bag_end', background: 'middle_earth', rarity: ItemRarity.Common },
    { name: 'meduseld', background: 'middle_earth', rarity: ItemRarity.Common },
    { name: 'gondor_shield', background: 'minas_tirith', rarity: ItemRarity.Common },
    { name: 'shagrat', background: 'mordor', rarity: ItemRarity.Common },
    { name: 'elven_shield', background: 'rivendell', rarity: ItemRarity.Common },
    { name: 'brego', background: 'rohan', rarity: ItemRarity.Common },
    { name: 'gamling', background: 'rohan', rarity: ItemRarity.Common },
    { name: 'hama', background: 'rohan', rarity: ItemRarity.Common },
    { name: 'farmer_maggot', background: 'shire', rarity: ItemRarity.Common },
    { name: 'gaffer_gamgee', background: 'shire', rarity: ItemRarity.Common },
    { name: 'l_s_baggins', background: 'shire', rarity: ItemRarity.Common },
    { name: 'odo_proudfoot', background: 'shire', rarity: ItemRarity.Common },
    { name: 'rosie_cotton', background: 'shire', rarity: ItemRarity.Common },
]

const rare: gifTemplate[] = [
    { name: 'grond', background: 'minas_morgul', rarity: ItemRarity.Rare },
    { name: 'king_of_the_dead', background: 'dunharrow', rarity: ItemRarity.Rare },
    { name: 'grishnakh', background: 'isengard', rarity: ItemRarity.Rare },
    { name: 'snaga', background: 'isengard', rarity: ItemRarity.Rare },
    { name: 'treebeard', background: 'isengard', rarity: ItemRarity.Rare },
    { name: 'haldir', background: 'lothlorien', rarity: ItemRarity.Rare },
    { name: 'argonath', background: 'middle_earth', rarity: ItemRarity.Rare },
    { name: 'black_gate', background: 'middle_earth', rarity: ItemRarity.Rare },
    { name: 'minas_morgul', background: 'middle_earth', rarity: ItemRarity.Rare },
    { name: 'eight_nazgul', background: 'minas_morgul', rarity: ItemRarity.Rare },
    { name: 'fell_beast', background: 'minas_morgul', rarity: ItemRarity.Rare },
    { name: 'gothmog', background: 'minas_morgul', rarity: ItemRarity.Rare },
    { name: 'ninth_nazgul', background: 'minas_morgul', rarity: ItemRarity.Rare },
    { name: 'seventh_nazgul', background: 'minas_morgul', rarity: ItemRarity.Rare },
    { name: 'sixth_nazgul', background: 'minas_morgul', rarity: ItemRarity.Rare },
    { name: 'crown_of_gondor', background: 'minas_tirith', rarity: ItemRarity.Rare },
    { name: 'horn_of_gondor', background: 'minas_tirith', rarity: ItemRarity.Rare },
    { name: 'gorbag', background: 'mordor', rarity: ItemRarity.Rare },
    { name: 'sting', background: 'rivendell', rarity: ItemRarity.Rare },
    { name: 'eowyn', background: 'rohan', rarity: ItemRarity.Rare },
]

const epic: gifTemplate[] = [
    { name: 'gandalf_the_gray', background: 'council_of_elrond', rarity: ItemRarity.Epic },
    { name: 'lurtz', background: 'isengard', rarity: ItemRarity.Epic },
    { name: 'palantir', background: 'isengard', rarity: ItemRarity.Epic },
    { name: 'celeborn', background: 'lothlorien', rarity: ItemRarity.Epic },
    { name: 'light_of_earendil', background: 'lothlorien', rarity: ItemRarity.Epic },
    { name: 'helms_deep', background: 'middle_earth', rarity: ItemRarity.Epic },
    { name: 'mount_doom', background: 'middle_earth', rarity: ItemRarity.Epic },
    { name: 'orthanc', background: 'middle_earth', rarity: ItemRarity.Epic },
    { name: 'fifth_nazgul', background: 'minas_morgul', rarity: ItemRarity.Epic },
    { name: 'fourth_nazgul', background: 'minas_morgul', rarity: ItemRarity.Epic },
    { name: 'second_nazgul', background: 'minas_morgul', rarity: ItemRarity.Epic },
    { name: 'third_nazgul', background: 'minas_morgul', rarity: ItemRarity.Epic },
    { name: 'denethor', background: 'minas_tirith', rarity: ItemRarity.Epic },
    { name: 'isildur', background: 'mordor', rarity: ItemRarity.Epic },
    { name: 'shelob', background: 'mordor', rarity: ItemRarity.Epic },
    { name: 'balrog', background: 'moria', rarity: ItemRarity.Epic },
    { name: 'arwen', background: 'rivendell', rarity: ItemRarity.Epic },
    { name: 'shards_of_narsil', background: 'rivendell', rarity: ItemRarity.Epic },
    { name: 'eomer', background: 'rohan', rarity: ItemRarity.Epic },
    { name: 'bilbo', background: 'shire', rarity: ItemRarity.Epic },
]

const legendary: gifTemplate[] = [
    { name: 'aragorn', background: 'council_of_elrond', rarity: ItemRarity.Legendary },
    { name: 'boromir', background: 'council_of_elrond', rarity: ItemRarity.Legendary },
    { name: 'gandalf_the_white', background: 'council_of_elrond', rarity: ItemRarity.Legendary },
    { name: 'gimli', background: 'council_of_elrond', rarity: ItemRarity.Legendary },
    { name: 'legolas', background: 'council_of_elrond', rarity: ItemRarity.Legendary },
    { name: 'frodo', background: 'council_of_elrond', rarity: ItemRarity.Legendary },
    { name: 'merry', background: 'council_of_elrond', rarity: ItemRarity.Legendary },
    { name: 'pippin', background: 'council_of_elrond', rarity: ItemRarity.Legendary },
    { name: 'samwise', background: 'council_of_elrond', rarity: ItemRarity.Legendary },
    { name: 'anduril', background: 'dunharrow', rarity: ItemRarity.Legendary },
    { name: 'saruman', background: 'isengard', rarity: ItemRarity.Legendary },
    { name: 'galadriel', background: 'lothlorien', rarity: ItemRarity.Legendary },
    { name: 'barad_dur', background: 'middle_earth', rarity: ItemRarity.Legendary },
    { name: 'witch_king', background: 'minas_morgul', rarity: ItemRarity.Legendary },
    { name: 'faramir', background: 'minas_tirith', rarity: ItemRarity.Legendary },
    { name: 'staff_of_gandalf', background: 'minas_tirith', rarity: ItemRarity.Legendary },
    { name: 'sauron', background: 'mordor', rarity: ItemRarity.Legendary },
    { name: 'gollum', background: 'mordor', rarity: ItemRarity.Legendary },
    { name: 'elrond', background: 'rivendell', rarity: ItemRarity.Legendary },
    { name: 'theoden', background: 'rohan', rarity: ItemRarity.Legendary },
]

const unobtainable: gifTemplate = { name: 'the_one_ring', background: 'black_texture', rarity: ItemRarity.Unobtainable }

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
