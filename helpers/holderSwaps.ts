import fs from 'fs'
import path from 'path'
import { ILootSeries, ItemRarity, IUserLootItem } from '../interfaces/database/databaseInterface'

export interface HolderSwap {
    /** Motive files are res/loot/<series>/motives/<file>_<n|s|g|d>.* */
    file: string
    displayName: string
}

/**
 * Items that look different while you hold the series' unobtainable. Only the holder sees the swap,
 * in their inventory and loot reveals - when someone else takes the unobtainable, they're back to normal.
 */
const swaps: Record<string, Record<string, HolderSwap>> = {
    kjlu: { kj: { file: 'rizztoffer', displayName: 'Rizztoffer Joner' } },
}

export class HolderSwaps {
    /** The swap for this item if the user currently holds its series' unobtainable */
    public static forItem(series: ILootSeries | undefined, userId: string, item: IUserLootItem): HolderSwap | undefined {
        if (!series || item.rarity === ItemRarity.Unobtainable) return undefined
        if (!series.unobtainableHolder || series.unobtainableHolder !== userId) return undefined
        return swaps[series.name]?.[item.name]
    }

    /** The swapped motive in the item's color, or undefined if the file is missing */
    public static motive(item: IUserLootItem, swap: HolderSwap): Buffer | undefined {
        const dir = path.join('res/loot', item.series, 'motives')
        if (!fs.existsSync(dir)) return undefined
        const name = `${swap.file}_${item.color.charAt(0)}`
        const file = fs.readdirSync(dir).find((f) => path.parse(f).name === name)
        return file ? fs.readFileSync(path.join(dir, file)) : undefined
    }

    /** The rarities of a series that have swapped items - the inventory parts to regenerate when the holder changes */
    public static raritiesWithSwaps(series: ILootSeries): ItemRarity[] {
        const names = Object.keys(swaps[series.name] ?? {})
        const rarities = [ItemRarity.Common, ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary]
        return rarities.filter((rarity) => ((series[rarity] as string[]) ?? []).some((name) => names.includes(name)))
    }
}
