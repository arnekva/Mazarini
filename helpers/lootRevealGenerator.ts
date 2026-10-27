import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { ItemColor, ItemRarity, IUserLootItem } from '../interfaces/database/databaseInterface'

/**
 * Series with a gifs/ folder here get their reveals generated on demand.
 *   gifs/<item>.gif        - optional per item, otherwise the first file in gifs/. Must end on fully transparent frames
 *   reveal/<item>.*        - the card's background: optional per item, otherwise the first file in reveal/
 *   motives/<item>_<n|s|g|d>.*, motives/unobtainable.* - full-size motives. Without one the caller falls back to the
 *                            item's emoji, which Discord keeps at only 128x128
 * (backgrounds/ is the series' inventory backgrounds, not used here)
 */
const SERIES_ROOT = 'res/loot'
const FONT = { path: 'res/fonts/Marcellus-Regular.ttf', family: 'Marcellus' }
/** Matches the hand-cut foil lettering of the light wreath's original poster */
const NAMECARD_FONT = { path: 'res/fonts/LuckiestGuy-Regular.ttf', family: 'Luckiest Guy' }
const MAX_SINGLE_LINE_LENGTH = 24

const rarityBand: Record<ItemRarity, { glow: string; edge: string }> = {
    [ItemRarity.Common]: { glow: '#9aa4b1', edge: '#4b5563' },
    [ItemRarity.Rare]: { glow: '#4aa3ff', edge: '#1e3a8a' },
    [ItemRarity.Epic]: { glow: '#9d2bff', edge: '#4a0a8c' },
    [ItemRarity.Legendary]: { glow: '#ffb02e', edge: '#9a3412' },
    [ItemRarity.Unobtainable]: { glow: '#ff3b3b', edge: '#7f1d1d' },
}

/** Tint for the foil lettering - none keeps the foil's own silver-grey */
const foilTint: Record<ItemColor, string | undefined> = {
    [ItemColor.None]: undefined,
    [ItemColor.Silver]: '#dfe7f5',
    [ItemColor.Gold]: '#ffb81c',
    [ItemColor.Diamond]: '#6fd8ff',
}

/** The halo behind the motive - an uncoloured item glows in its rarity's colour instead */
const haloColor: Record<ItemColor, string | undefined> = {
    [ItemColor.None]: undefined,
    [ItemColor.Silver]: '#e8eef8',
    [ItemColor.Gold]: '#ffc93c',
    [ItemColor.Diamond]: '#7fe3ff',
}

const nameColor: Record<ItemColor, string> = {
    [ItemColor.None]: '#ffffff',
    [ItemColor.Silver]: '#dfe4ea',
    [ItemColor.Gold]: '#ffd34d',
    [ItemColor.Diamond]: '#b9f2ff',
}

/**
 * Builds a reveal on demand: background + item + rarity band + name, with the series' reveal animation on top.
 * The reveal hides the card until it wipes to transparent, so the card is just a static image underneath every frame.
 */
export class LootRevealGenerator {
    private static files = new Map<string, Buffer>()

    public static hasAssets(series: string): boolean {
        return fs.existsSync(path.join(SERIES_ROOT, series, 'gifs'))
    }

    /** The item's full-size motive from motives/, or undefined if the series has none for it */
    public static localMotive(item: IUserLootItem): Buffer | undefined {
        const dir = path.join(SERIES_ROOT, item.series, 'motives')
        if (!fs.existsSync(dir)) return undefined
        const name = item.rarity === ItemRarity.Unobtainable ? 'unobtainable' : `${item.name}_${item.color.charAt(0)}`
        const file = fs.readdirSync(dir).find((f) => path.parse(f).name === name)
        return file ? this.readFile(path.join(dir, file)) : undefined
    }

    public static async generate(item: IUserLootItem, motive: Buffer, displayName: string): Promise<Buffer> {
        const revealFile = this.readFile(this.pickFile(item, 'gifs'))
        const meta = await sharp(revealFile, { animated: true }).metadata()
        const width = meta.width
        const height = meta.pageHeight

        const card = await this.buildCard(item, motive, displayName, width, height)
        return sharp(card)
            .extend({ bottom: height * (meta.pages - 1), extendWith: 'repeat' })
            .composite([{ input: revealFile, animated: true }])
            .webp({ delay: meta.delay, loop: 1, effort: 2, quality: 75 })
            .toBuffer()
    }

    private static async buildCard(item: IUserLootItem, motive: Buffer, displayName: string, width: number, height: number): Promise<Buffer> {
        const background = sharp(this.readFile(this.pickFile(item, 'reveal'))).resize(width, height, { fit: 'cover' })
        const lines = this.wrapName(displayName)
        const hasNamecard = fs.existsSync(this.namecardFile(item, 'wreath.png'))
        // The wreath sits at the top with the motive in the space below it (only its soft lower edge overlaps).
        // The plain band goes across the bottom, over the motive.
        const plate = hasNamecard
            ? await this.buildWreathPlate(item, lines, width)
            : await this.buildNameplate(item, lines, width, Math.round(height * (lines.length > 1 ? 0.3 : 0.2)))
        const plateInfo = await sharp(plate).metadata()
        const motiveSpace = hasNamecard ? height - Math.round(plateInfo.height * 0.82) : Math.round(height * 0.86)
        const itemImage = await sharp(motive)
            .trim({ threshold: 1 })
            .resize({ width: Math.round(width * 0.9), height: motiveSpace, fit: 'inside' })
            .toBuffer({ resolveWithObject: true })

        const itemTop = height - itemImage.info.height
        const itemLeft = Math.round((width - itemImage.info.width) / 2)
        const halo = this.buildHalo(item, width, height, {
            x: itemLeft + itemImage.info.width / 2,
            y: itemTop + itemImage.info.height * 0.45,
            r: Math.max(itemImage.info.width, itemImage.info.height) * 0.75,
        })

        return background
            .composite([
                { input: halo, top: 0, left: 0 },
                { input: itemImage.data, top: itemTop, left: itemLeft },
                { input: plate, top: hasNamecard ? 0 : height - plateInfo.height, left: Math.round((width - plateInfo.width) / 2) },
            ])
            .png()
            .toBuffer()
    }

    /** Soft glow behind the motive, in the item's colour (or its rarity's, when it has none) */
    private static buildHalo(item: IUserLootItem, width: number, height: number, centre: { x: number; y: number; r: number }): Buffer {
        const color = haloColor[item.color] ?? (rarityBand[item.rarity] ?? rarityBand[ItemRarity.Common]).glow
        return Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <defs><radialGradient id="h">
                    <stop offset="0" stop-color="#ffffff" stop-opacity=".9"/>
                    <stop offset=".5" stop-color="${color}" stop-opacity=".9"/>
                    <stop offset=".75" stop-color="${color}" stop-opacity=".4"/>
                    <stop offset="1" stop-color="${color}" stop-opacity="0"/>
                </radialGradient></defs>
                <circle cx="${centre.x}" cy="${centre.y}" r="${centre.r}" fill="url(#h)"/>
            </svg>`
        )
    }

    private static namecardFile(item: IUserLootItem, file: string) {
        return path.join(SERIES_ROOT, item.series, 'namecard', file)
    }

    /**
     * The series' own name card: a wreath of lights (namecard/wreath.png, transparent around the bulbs) with the name inside,
     * in crumpled foil (namecard/foil.png, tiled) tinted by the item's colour, over a soft glow in the rarity's colour
     */
    private static async buildWreathPlate(item: IUserLootItem, lines: string[], cardWidth: number): Promise<Buffer> {
        const wreath = await sharp(this.readFile(this.namecardFile(item, 'wreath.png')))
            .resize({ width: Math.round(cardWidth * 0.78) })
            .toBuffer({ resolveWithObject: true })
        const { width, height } = wreath.info
        // where the original lettering sat inside the wreath
        const centre = { x: width * 0.52, y: height * 0.51 }
        const box = { w: width * 0.74, h: height * (lines.length > 1 ? 0.46 : 0.3) }

        const band = rarityBand[item.rarity] ?? rarityBand[ItemRarity.Common]
        const glow = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <defs><radialGradient id="g">
                    <stop offset="0" stop-color="${band.glow}" stop-opacity=".95"/>
                    <stop offset=".6" stop-color="${band.edge}" stop-opacity=".55"/>
                    <stop offset="1" stop-color="${band.edge}" stop-opacity="0"/>
                </radialGradient></defs>
                <ellipse cx="${centre.x}" cy="${centre.y}" rx="${width * 0.42}" ry="${height * 0.3}" fill="url(#g)"/>
            </svg>`
        )
        const text = await sharp(await this.renderFoilName(item, lines))
            .resize({ width: Math.round(box.w), height: Math.round(box.h), fit: 'inside' })
            .toBuffer({ resolveWithObject: true })

        return sharp(glow)
            .composite([
                { input: wreath.data },
                { input: text.data, left: Math.round(centre.x - text.info.width / 2), top: Math.round(centre.y - text.info.height / 2) },
            ])
            .png()
            .toBuffer()
    }

    /** The name in the namecard font, filled with tiled foil tinted by the item's colour, with a dark edge so it reads over the lights */
    private static async renderFoilName(item: IUserLootItem, lines: string[]): Promise<Buffer> {
        const fontSize = 96
        const name = lines.join('\n').toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;')
        const glyphs = await sharp({
            text: {
                text: `<span foreground="#ffffff">${name}</span>`,
                font: `${NAMECARD_FONT.family} ${fontSize}`,
                fontfile: path.resolve(NAMECARD_FONT.path),
                rgba: true,
                dpi: 72,
                align: 'centre',
                spacing: Math.round(fontSize * -0.15),
            },
        })
            .png()
            .toBuffer({ resolveWithObject: true })
        const { width, height } = glyphs.info

        // the foil patch, scaled to the lettering's size and mirrored so the tiles join up
        const patch = await sharp(this.readFile(this.namecardFile(item, 'foil.png')))
            .resize({ height: Math.round(fontSize * 0.55) })
            .toBuffer({ resolveWithObject: true })
        const pw = patch.info.width,
            ph = patch.info.height
        const tile = await sharp({ create: { width: pw * 2, height: ph * 2, channels: 4, background: '#000' } })
            .composite([
                { input: patch.data, left: 0, top: 0 },
                { input: await sharp(patch.data).flop().toBuffer(), left: pw, top: 0 },
                { input: await sharp(patch.data).flip().toBuffer(), left: 0, top: ph },
                { input: await sharp(patch.data).flip().flop().toBuffer(), left: pw, top: ph },
            ])
            .png()
            .toBuffer()
        // tiled onto whole tiles (an overlay can't be bigger than its base), then cropped to the text
        const cols = Math.ceil(width / (pw * 2)),
            rows = Math.ceil(height / (ph * 2))
        const tiles: sharp.OverlayOptions[] = []
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles.push({ input: tile, left: c * pw * 2, top: r * ph * 2 })
        const tiled = await sharp({ create: { width: cols * pw * 2, height: rows * ph * 2, channels: 4, background: '#000' } })
            .composite(tiles)
            .png()
            .toBuffer()
        let foil = await sharp(tiled).extract({ left: 0, top: 0, width, height }).png().toBuffer()
        const tint = foilTint[item.color]
        if (tint) {
            // multiply keeps the crumple's light and dark, then brighten back up so it still shines
            foil = await sharp(foil)
                .composite([{ input: { create: { width, height, channels: 4, background: tint } }, blend: 'multiply' }])
                .linear(1.35, 0)
                .png()
                .toBuffer()
        }
        const foilText = await sharp(foil)
            .composite([{ input: glyphs.data, blend: 'dest-in' }])
            .png()
            .toBuffer()

        // dark edge: the glyphs in black, spread a few pixels and softened
        const stroke = Math.round(fontSize / 14)
        const edge = await sharp(glyphs.data)
            .extend({ top: stroke * 2, bottom: stroke * 2, left: stroke * 2, right: stroke * 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .modulate({ brightness: 0 })
            .blur(stroke)
            .linear([1, 1, 1, 3], [0, 0, 0, 0]) // thicken the blurred alpha back into a solid edge
            .png()
            .toBuffer()
        return sharp(edge)
            .composite([{ input: foilText, left: stroke * 2, top: stroke * 2 }])
            .png()
            .toBuffer()
    }

    /** Per-item file if there is one (<folder>/<item name>.*), otherwise the series' shared one */
    private static pickFile(item: IUserLootItem, folder: 'gifs' | 'reveal'): string {
        const dir = path.join(SERIES_ROOT, item.series, folder)
        const files = fs.readdirSync(dir).sort()
        const file = files.find((f) => path.parse(f).name === item.name) ?? files[0]
        if (!file) throw new Error(`Fant ingen filer i ${dir}`)
        return path.join(dir, file)
    }

    private static readFile(file: string): Buffer {
        if (!this.files.has(file)) this.files.set(file, fs.readFileSync(file))
        return this.files.get(file)
    }

    /** Names too long to read on one line are split at the space closest to the middle */
    private static wrapName(displayName: string): string[] {
        if (displayName.length <= MAX_SINGLE_LINE_LENGTH || !displayName.includes(' ')) return [displayName]
        const middle = displayName.length / 2
        let split = -1
        for (let i = 0; i < displayName.length; i++) {
            if (displayName[i] === ' ' && (split === -1 || Math.abs(i - middle) < Math.abs(split - middle))) split = i
        }
        return [displayName.slice(0, split), displayName.slice(split + 1)]
    }

    /** Rarity glow band with the item name on top, coloured by the item's colour - for series without a namecard/ */
    private static async buildNameplate(item: IUserLootItem, lines: string[], width: number, height: number): Promise<Buffer> {
        const band = rarityBand[item.rarity] ?? rarityBand[ItemRarity.Common]
        const bandSvg = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <defs><linearGradient id="g" x1="0" x2="1">
                    <stop offset="0" stop-color="${band.edge}" stop-opacity="0"/>
                    <stop offset=".5" stop-color="${band.glow}" stop-opacity=".9"/>
                    <stop offset="1" stop-color="${band.edge}" stop-opacity="0"/>
                </linearGradient></defs>
                <rect x="0" y="${height * 0.15}" width="${width}" height="${height * 0.7}" fill="url(#g)"/>
            </svg>`
        )
        const text = await sharp(await this.renderName(item, lines, 64))
            .resize({ width: Math.round(width * 0.9), height: Math.round(height * (lines.length > 1 ? 0.8 : 0.6)), fit: 'inside' })
            .toBuffer({ resolveWithObject: true })

        return sharp(bandSvg)
            .composite([{ input: text.data, top: Math.round((height - text.info.height) / 2), left: Math.round((width - text.info.width) / 2) }])
            .png()
            .toBuffer()
    }

    /** Uses sharp's own text rendering with the font file - canvas' registerFont doesn't work on Windows */
    private static async renderName(item: IUserLootItem, lines: string[], fontSize: number): Promise<Buffer> {
        const name = lines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        const render = (color: string) =>
            sharp({
                text: {
                    text: `<span foreground="${color}">${name}</span>`,
                    font: `${FONT.family} ${fontSize}`,
                    fontfile: path.resolve(FONT.path),
                    rgba: true,
                    dpi: 72,
                    align: 'centre',
                },
            })
                .png()
                .toBuffer({ resolveWithObject: true })
        const [fill, outline] = await Promise.all([render(nameColor[item.color] ?? nameColor[ItemColor.None]), render('#000000')])
        const stroke = Math.max(1, Math.round(fontSize / 20))
        const offsets: sharp.OverlayOptions[] = []
        for (let x = -stroke; x <= stroke; x++) {
            for (let y = -stroke; y <= stroke; y++) {
                if (x * x + y * y <= stroke * stroke) offsets.push({ input: outline.data, left: stroke + x, top: stroke + y })
            }
        }
        return sharp({
            create: { width: fill.info.width + stroke * 2, height: fill.info.height + stroke * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
        })
            .composite([...offsets, { input: fill.data, left: stroke, top: stroke }])
            .png()
            .toBuffer()
    }
}
