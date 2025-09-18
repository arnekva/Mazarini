import { MazariniClient } from '../client/MazariniClient'
import { ImageGenerationHelper } from '../helpers/imageGenerationHelper'
import {
    ILootStats,
    ILootStatsColorCounter,
    IPityTracker,
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

    public refactorUserLoot(user: MazariniUser) {
        const mazarini: IUserLootSeries = {
            name: 'mazarini',
            pityLevel: structuredClone(defaultPityLevel),
            inventory: structuredClone(defaultInventory),
            stats: structuredClone(defaultLootStats),
        }
        const sw: IUserLootSeries = {
            name: 'sw',
            pityLevel: structuredClone(defaultPityLevel),
            inventory: structuredClone(defaultInventory),
            stats: structuredClone(defaultLootStats),
        }
        const hp: IUserLootSeries = {
            name: 'hp',
            pityLevel: structuredClone(defaultPityLevel),
            inventory: structuredClone(defaultInventory),
            stats: structuredClone(defaultLootStats),
        }
        const lotr: IUserLootSeries = {
            name: 'lotr',
            pityLevel: structuredClone(defaultPityLevel),
            inventory: structuredClone(defaultInventory),
            stats: structuredClone(defaultLootStats),
        }
        const loot: IUserLoot = { mazarini: mazarini, sw: sw, hp: hp, lotr: lotr }
        for (const item of user.collectables) {
            loot[item.series]['inventory'][item.rarity]['items'].push(item)
        }
        user.loot = loot
        this.client.database.updateUser(user)
    }

    public async generateNewLootInventory(user: MazariniUser) {
        //TODO: Fjern "test/"
        const imgGen = new ImageGenerationHelper(this.client)
        for (const series of ['mazarini', 'sw', 'hp']) {
            console.log(series)

            const common = await imgGen.generateImageForCollectablesRarity(user.loot[series]['inventory']['common']['items'], series, ItemRarity.Common)
            this.client.database.uploadUserInventory(user, `test/inventory/${series}/common.png`, common)

            const rare = await imgGen.generateImageForCollectablesRarity(user.loot[series][`inventory`][`rare`]['items'], series, ItemRarity.Rare)
            this.client.database.uploadUserInventory(user, `test/inventory/${series}/rare.png`, rare)

            const epic = await imgGen.generateImageForCollectablesRarity(user.loot[series][`inventory`][`epic`]['items'], series, ItemRarity.Epic)
            this.client.database.uploadUserInventory(user, `test/inventory/${series}/epic.png`, epic)

            const legendary = await imgGen.generateImageForCollectablesRarity(
                user.loot[series][`inventory`][`legendary`]['items'],
                series,
                ItemRarity.Legendary
            )
            this.client.database.uploadUserInventory(user, `test/inventory/${series}/legendary.png`, legendary)
        }
    }

    public async setInventoryUrls(user: MazariniUser) {
        for (const series of ['mazarini', 'sw', 'hp']) {
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
}
