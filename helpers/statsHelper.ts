import { ILootbox, ILootStats, IUserLootItem } from '../interfaces/database/databaseInterface'

export class LootStatsHelper {
    private lootStats: ILootStats

    constructor(stats: ILootStats) {
        this.lootStats = stats
    }

    registerPurchase(box: ILootbox, isChest: boolean, wasPurchased: boolean) {
        if (wasPurchased) {
            this.lootStats.chipsSpent += box.price * (isChest ? 2 : 1)
        }
        const type = isChest ? 'chestsOpened' : 'boxesOpened'
        const quality = ['basic', 'premium', 'elite'].includes(box.name) ? box.name : 'special'
        this.lootStats[type][quality] = (this.lootStats[type][quality] ?? 0) + 1
    }

    registerItem(item: IUserLootItem) {
        this.lootStats.rarities[item.rarity][item.color] = (this.lootStats.rarities[item.rarity][item.color] ?? 0) + 1
    }

    registerTrade(isTradeUp: boolean) {
        const type = isTradeUp ? 'up' : 'in'
        this.lootStats.trades[type] = (this.lootStats.trades[type] ?? 0) + 1
    }
}
