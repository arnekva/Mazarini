import fs from 'fs'
import path from 'path'
import { ILootSeries, ILootSeriesInventoryArt, IUserLootSeries } from '../interfaces/database/databaseInterface'

/** How strongly a background from a series folder shows through - the same as the LOTR ones */
const FOLDER_OPACITY = 0.5

/**
 * Inventory backgrounds ("art"): one 1147x1968 image per background, a quarter of it behind each rarity row.
 * Series with a res/loot/<series>/backgrounds/ folder take theirs from it - the file name is the background's name.
 * Older series list theirs on the series in the database, with the images in graphics/background/inventory_art/.
 */
export namespace InventoryArts {
    const folder = (seriesName: string) => path.join('res/loot', seriesName, 'backgrounds')

    export function forSeries(series: ILootSeries): ILootSeriesInventoryArt[] {
        const dir = folder(series.name)
        if (fs.existsSync(dir)) {
            return fs
                .readdirSync(dir)
                .sort()
                .map((file) => ({ name: path.parse(file).name, opacity: FOLDER_OPACITY }))
        }
        return series.inventoryArts ?? []
    }

    export function imagePath(seriesName: string, art: ILootSeriesInventoryArt): string {
        const dir = folder(seriesName)
        const file = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => path.parse(f).name === art.name) : undefined
        return file ? path.join(dir, file) : `graphics/background/inventory_art/${art.name}.png`
    }

    /** Names of the backgrounds the user has unlocked. Before unlocks, buying one replaced the old one - so that one counts as unlocked */
    export function unlocked(userSeries?: IUserLootSeries): string[] {
        if (userSeries?.unlockedArts) return userSeries.unlockedArts
        return userSeries?.inventoryArt ? [userSeries.inventoryArt.name] : []
    }

    export function displayName(art: ILootSeriesInventoryArt): string {
        const name = art.name.replace(/_/g, ' ')
        return name.charAt(0).toUpperCase() + name.slice(1)
    }
}
