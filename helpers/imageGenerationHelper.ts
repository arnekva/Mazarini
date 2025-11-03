import { Image } from 'canvas'
import sharp from 'sharp'
import { IFontWeight, IImage, IOptions, IRepeat, UltimateTextToImage, getCanvasImage, registerFont } from 'ultimate-text-to-image'
import { MazariniClient } from '../client/MazariniClient'
import {
    ILootSeries,
    ILootSeriesInventoryArt,
    IUserLootItem,
    IUserLootSeriesInventory,
    ItemColor,
    ItemRarity,
    MazariniUser,
} from '../interfaces/database/databaseInterface'
import { TextUtils } from '../utils/textUtils'
import { EmojiHelper } from './emojiHelper'

const fs = require('fs')

interface ICollectableImage {
    backgroundUrl: string
    options: Partial<IOptions>
    common: IItemShadowCoordinates[]
    rare: IItemShadowCoordinates[]
    epic: IItemShadowCoordinates[]
    legendary: IItemShadowCoordinates[]
}

interface IImageCoordinates {
    layer: number
    repeat: IRepeat
    x: number
    y: number
    width: number
    height: number
}

interface IItemShadowCoordinates {
    centerX: number
    centerY: number
    width: number
    height: number
}

interface IRevealGifSetup {
    revealWidth: number
    revealHeight: number
    background: string
    gif: string
    font: IFontSetup
    ratios: IRatios
}

interface IFontSetup {
    path: string
    family: string
    weight: IFontWeight
    primaryColor: string
    outlineColor: string
}

interface IRatios {
    halo: number
    rarityEffect: IRarityEffectRatios
    item: IItemRatios
    textHeight: number
}

interface IRarityEffectRatios {
    scaleWidth: number
    scaleHeight: number
    top: number
}

interface IItemRatios {
    size: number
    coords: (item: Buffer) => Promise<{ top: number; left: number }>
}

const star_wars_setup: IRevealGifSetup = {
    revealWidth: 960,
    revealHeight: 720,
    background: 'graphics/background/mos_eisley_bg.png',
    gif: 'graphics/sw.gif',
    font: {
        path: 'graphics/fonts/SfDistantGalaxy-0l3d.ttf',
        family: 'SF Distant Galaxy',
        weight: 500,
        primaryColor: '#000000',
        outlineColor: '#FFE81F',
    },
    ratios: {
        halo: Math.floor(720 * 0.85),
        rarityEffect: {
            scaleWidth: Math.floor(960 * 1.25),
            scaleHeight: Math.floor(720 * 0.8),
            top: Math.floor(720 * 0.35),
        },
        item: {
            size: Math.floor(720 * 0.75),
            coords: async (item: Buffer) => {
                const meta = await sharp(item).metadata()
                const top = 620 - meta.height
                const left = Math.floor(960 / 2 - meta.width / 2)
                return { top: top, left: left }
            },
        },
        textHeight: Math.floor(720 * 0.056),
    },
}

const harry_potter_setup: IRevealGifSetup = {
    revealWidth: 960,
    revealHeight: 720,
    background: 'graphics/background/hp/',
    gif: 'graphics/hp_reveal_gif.webp',
    font: {
        path: 'graphics/fonts/SfDistantGalaxy-0l3d.ttf',
        family: 'SF Distant Galaxy',
        weight: 500,
        primaryColor: '#000000',
        outlineColor: '#FFE81F',
    },
    ratios: {
        halo: Math.floor(720 * 0.85),
        rarityEffect: {
            scaleWidth: Math.floor(960 * 1.25),
            scaleHeight: Math.floor(720 * 0.8),
            top: Math.floor(720 * 0.35),
        },
        item: {
            size: Math.floor(720 * 0.75),
            coords: async (item: Buffer) => {
                const meta = await sharp(item).metadata()
                const top = 620 - meta.height
                const left = Math.floor(960 / 2 - meta.width / 2)
                return { top: top, left: left }
            },
        },
        textHeight: Math.floor(720 * 0.056),
    },
}

const mazarini_setup: IRevealGifSetup = {
    revealWidth: 960,
    revealHeight: 720,
    background: 'graphics/background/background.png',
    gif: 'graphics/sf_kino.gif',
    font: {
        path: 'graphics/fonts/WorkSans-Medium.ttf',
        family: 'Work Sans',
        weight: 500,
        primaryColor: '#ffffff',
        outlineColor: '#000000',
    },
    ratios: {
        halo: Math.floor(720 * 0.85),
        rarityEffect: {
            scaleWidth: Math.floor(960 * 1.25),
            scaleHeight: Math.floor(720 * 0.8),
            top: Math.floor(720 * 0.35),
        },
        item: {
            size: Math.floor(720 * 0.5),
            coords: async (item: Buffer) => {
                const meta = await sharp(item).metadata()
                const top = Math.floor(720 / 2.5 - meta.height / 2)
                const left = Math.floor(960 / 2 - meta.width / 2)
                return { top: top, left: left }
            },
        },
        textHeight: Math.floor(720 * 0.056),
    },
}

const lotr_setup: IRevealGifSetup = {
    revealWidth: 800,
    revealHeight: 600,
    background: '',
    gif: 'temp/lotr_cut.webp',
    font: {
        path: 'temp/font/Aniron.ttf',
        family: 'Aniron',
        weight: 500,
        primaryColor: '#efebdd',
        outlineColor: '#FFE81F',
    },
    ratios: {
        halo: Math.floor(600 * 0.85),
        rarityEffect: {
            scaleWidth: Math.floor(800 * 1.25),
            scaleHeight: Math.floor(600 * 0.8),
            top: Math.floor(600 * 0.35),
        },
        item: {
            size: Math.floor(600 * 0.75),
            coords: async (item: Buffer) => {
                const meta = await sharp(item).metadata()
                const top = 500 - meta.height
                const left = Math.floor(800 / 2 - meta.width / 2)
                return { top: top, left: left }
            },
        },
        textHeight: Math.floor(600 * 0.056),
    },
}

const currentSetup: IRevealGifSetup = lotr_setup

const inventoryOptions: IImageCoordinates = {
    layer: -1,
    repeat: 'fit',
    x: 0,
    y: 0,
    width: 1147,
    height: 1968,
}

const splitInventoryOptions: IImageCoordinates = {
    layer: -1,
    repeat: 'fit',
    x: 0,
    y: 0,
    width: 1147,
    height: 1968 / 4,
}

export class ImageGenerationHelper {
    private client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }

    public async makeApplicationEmoji(collectable: IUserLootItem): Promise<Buffer> {
        const item = fs.readFileSync(`temp/${collectable.rarity}/${collectable.name}.png`)
        const resizedItem = await sharp(item).resize({ fit: sharp.fit.cover, width: 128, height: 128 }).toBuffer()
        return resizedItem
    }

    public async generateRevealGifForCollectable(collectable: IUserLootItem, bg: string): Promise<Buffer> {
        const backgroundWithItem = await this.getBackgroundWithItem(collectable, bg)
        // return backgroundWithItem
        // const lightrayAndText = await this.getLightrayAndText(collectable)
        // const revealBackground = await sharp(backgroundWithItem)
        //     .composite([{ input: lightrayAndText, top: ratios.lightrayTop, left: 0 }])
        //     .toBuffer()
        const text = await this.getHeaderText(collectable)

        const revealBackground = await sharp(backgroundWithItem).composite(text).toBuffer()
        // return revealBackground
        const gifBuffer = fs.readFileSync(currentSetup.gif)

        return await this.overlayGif(revealBackground, gifBuffer)
    }

    private async getBackgroundWithItem(collectable: IUserLootItem, bg: string): Promise<Buffer> {
        const background = fs.readFileSync(`temp/background/${bg}.png`)
        const resizedBg = await sharp(background)
            .resize({ fit: sharp.fit.cover, width: currentSetup.revealWidth, height: currentSetup.revealHeight })
            .toBuffer()
        const halo = await this.getHalo(collectable.rarity)
        const item = fs.readFileSync(`temp/${collectable.rarity}/${collectable.name}.png`) //await this.getItemBuffer(collectable)
        const isUnobtainable = collectable.rarity === ItemRarity.Unobtainable
        const size = isUnobtainable ? 120 : 400
        const resizedItem = await sharp(item).resize({ fit: sharp.fit.cover, width: size, height: size }).toBuffer()
        let backgroundBuffer = resizedBg
        if (isUnobtainable) {
            const hand = fs.readFileSync(`temp/halo/hand.png`)
            backgroundBuffer = await this.compositeBuffers(resizedBg, hand, 0, 0)
            const shadow = fs.readFileSync(`temp/halo/shadow3.png`)
            const resizedShadow = await sharp(shadow).resize({ fit: sharp.fit.cover, width: 250, height: 250 }).toBuffer()
            backgroundBuffer = await this.compositeBuffers(backgroundBuffer, resizedShadow, 135, 275)
        }
        if (halo) {
            const coords = await currentSetup.ratios.item.coords(halo)
            backgroundBuffer = await this.compositeBuffers(backgroundBuffer, halo, isUnobtainable ? 0 : 10 - 50 /*coords.top*/, coords.left)
        }
        // return backgroundBuffer
        const nameplate = fs.readFileSync(`temp/nameplate/${collectable.rarity}_w.png`)
        // const resizedNameplate = await sharp(nameplate).resize({ fit: sharp.fit.inside, width: 500, height: 200 }).toBuffer()

        // const badgeHalo = this.getRarityHalo(collectable.rarity)
        // const badgeWithHalo = await this.compositeBuffers(badgeHalo, resizedBadge, 100, 120)
        const coords = await currentSetup.ratios.item.coords(resizedItem)
        const top = isUnobtainable ? 200 : coords.top - 50
        const img = await this.compositeBuffers(backgroundBuffer, resizedItem, top, coords.left)
        if (isUnobtainable) return img
        return await this.compositeBuffers(img, nameplate, 400, 150)
        return img
        // return await this.compositeBuffers(img, badgeWithHalo, 400, 660)
    }

    private async getHalo(rarity: ItemRarity): Promise<Buffer> {
        const isUnobtainable = rarity === ItemRarity.Unobtainable
        // if (rarity === ItemRarity.Unobtainable) return undefined
        const halo = fs.readFileSync(`temp/halo/${rarity}.png`)
        return await this.resize(halo, false, isUnobtainable ? 800 : 600)
    }

    private getRarityHalo(rarity: ItemRarity): Buffer {
        let color = ''
        if (rarity === ItemRarity.Common) color = 'yellow'
        else if (rarity === ItemRarity.Rare) color = 'blue'
        else if (rarity === ItemRarity.Epic) color = 'green'
        else color = 'red'
        return fs.readFileSync(`graphics/halo/${color}.png`)
    }

    private async getItemBuffer(collectable: IUserLootItem): Promise<Buffer> {
        const itemUrl = await this.getEmojiImageUrl(collectable, true)
        const item = await fetch(itemUrl)
        const itemBuffer = Buffer.from(await item.arrayBuffer())
        return await this.resize(itemBuffer, false, currentSetup.ratios.item.size)
    }

    private async getLightrayAndText(collectable: IUserLootItem): Promise<Buffer> {
        const lightray = fs.readFileSync(`graphics/lightray/${collectable.rarity}.png`)
        const resizedLightray = sharp(lightray)
            .resize({ fit: sharp.fit.cover, width: currentSetup.ratios.rarityEffect.scaleWidth })
            .resize({ fit: sharp.fit.cover, width: currentSetup.revealWidth, height: currentSetup.ratios.rarityEffect.scaleHeight })
        const text = await this.getHeaderText(collectable)

        const lr = await resizedLightray.toBuffer()
        return sharp(lr).composite(text).toBuffer()
    }

    private async getHeaderText(collectable: IUserLootItem): Promise<sharp.OverlayOptions[]> {
        registerFont(currentSetup.font.path, { family: currentSetup.font.family, weight: currentSetup.font.weight })
        const fontSize = 50
        let header = `${TextUtils.formatRevealGifString(collectable.name)}`
        const isUnobtainable = collectable.rarity === ItemRarity.Unobtainable
        if (isUnobtainable) header = 'You are now the ring bearer'
        const itemHeader = new UltimateTextToImage(header, {
            fontFamily: currentSetup.font.family,
            fontColor: currentSetup.font.primaryColor,
            fontSize: fontSize,
            fontWeight: currentSetup.font.weight,
            margin: 2,
        })
            .render()
            .toBuffer()
        const resizedHeader = await sharp(itemHeader)
            .resize({ fit: sharp.fit.inside, height: currentSetup.ratios.textHeight, width: isUnobtainable ? 700 : 360 })
            .toBuffer()
        // legendary: '#d1700f'
        // epic: '#7223cc'
        // const outline = new UltimateTextToImage(header, {
        //     fontFamily: currentSetup.font.family,
        //     fontColor: '#f5e12f', // //currentSetup.font.outlineColor, //'#f55525', //
        //     fontSize: fontSize,
        //     fontWeight: currentSetup.font.weight,
        //     margin: 2,
        // })
        //     .render()
        //     .toBuffer()
        // const resizedOutline = await sharp(outline).resize({ fit: sharp.fit.inside, height: currentSetup.ratios.textHeight }).toBuffer()
        const headerMeta = await sharp(resizedHeader).metadata()
        const top = Math.floor(330 - headerMeta.height / 2)
        const left = Math.floor(400 - headerMeta.width / 2)
        const texts: sharp.OverlayOptions[] = new Array<sharp.OverlayOptions>()
        texts.push({ input: resizedHeader, top: top - 48 + currentSetup.ratios.rarityEffect.top, left: left })
        return texts
        // return this.getOutlineText(resizedHeader, resizedOutline, top - 40, left, 2)
    }

    private async resize(buffer: Buffer, isGif: boolean, size: number, padding: number = 0): Promise<Buffer> {
        return await sharp(buffer, { animated: isGif })
            .resize({
                fit: sharp.fit.inside,
                height: size,
                width: size,
            })
            .extend({ top: padding, left: padding, bottom: padding, right: padding, background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer()
    }

    private compositeBuffers(background: Buffer, overlay: Buffer, top?: number, left?: number): Promise<Buffer> {
        return sharp(background)
            .composite([{ input: overlay, gravity: 'center', top: top, left: left }])
            .toBuffer()
    }

    private getOutlineText(text: Buffer, outline: Buffer, topOffset: number, leftOffset: number, layers: number): sharp.OverlayOptions[] {
        const texts: sharp.OverlayOptions[] = new Array<sharp.OverlayOptions>()
        for (let x = -layers; x <= layers; x++) {
            for (let y = -layers; y <= layers; y++) {
                texts.push({ input: outline, top: topOffset + x + currentSetup.ratios.rarityEffect.top, left: leftOffset + y })
            }
        }
        texts.push({ input: text, top: topOffset + currentSetup.ratios.rarityEffect.top, left: leftOffset })
        return texts
    }

    private async overlayGif(background: Buffer, gifOverlay: Buffer) {
        //takes two input paths.
        const overlay = sharp(gifOverlay, { animated: true }) //make sure animated is true.
        const metadata = await overlay.metadata() //We'll use the gif metadata to normalize the background.
        const backgroundImg = sharp(background).resize(metadata.width, metadata.pageHeight) //We are resizing here to normalize background with gif.
        const imgRoll = backgroundImg.extend({ bottom: metadata.pageHeight * (metadata.pages - 1), extendWith: 'repeat' }) //Must extend to repeat how ever many pages (frames) are in the gif.

        const result = imgRoll.composite([{ input: await overlay.toBuffer(), gravity: 'north', animated: true }]).webp(
            { delay: metadata.delay, loop: 1, effort: 0 }
            // new Array(metadata.delay.length).fill(50)
            //Just copying the metadata from the gif to the output format (not sure this is necessary).
        )

        const resInfo = await result.toBuffer()
        return resInfo
    }

    public async generateImageForCollectables(collectables: IUserLootItem[]): Promise<Buffer> {
        const appendSeries = collectables[0].series === 'hp' ? '_hp' : ''
        const background = fs.readFileSync(`graphics/background/inventory_bg${appendSeries}.png`)
        if (!collectables) return background
        const canvas = await getCanvasImage({ buffer: background })
        const imageTemplate: ICollectableImage = inventoryTemplate
        const images = await this.getImageSeriesForCollectables(collectables, imageTemplate)
        images.push({ ...inventoryOptions, canvasImage: canvas })
        const collection = new UltimateTextToImage('', { ...imageTemplate.options, images: images }).render().toBuffer()
        return collection
    }

    public async generateImageForCollectablesRarity(user: MazariniUser, series: ILootSeries, rarity: ItemRarity): Promise<Buffer> {
        let collectables = user.loot[series.name]['inventory'][rarity]['items'] as IUserLootItem[]
        const background = await this.getInventoryBackground(user, series, rarity)
        if (!collectables) return background
        collectables = collectables.sort((a, b) => `${a.name}_${this.getColorOrder(a.color)}`.localeCompare(`${b.name}_${this.getColorOrder(b.color)}`))
        const canvas = await getCanvasImage({ buffer: background })
        const imageTemplate: ICollectableImage = splitInventoryTemplate
        const images = await this.getImagesForRarity(collectables, imageTemplate[rarity])
        images.push({ ...splitInventoryOptions, canvasImage: canvas })
        const collection = new UltimateTextToImage('', { ...imageTemplate.options, images: images }).render().toBuffer()
        return collection
    }

    private getColorOrder(color: ItemColor) {
        if (color === ItemColor.None) return 1
        else if (color === ItemColor.Silver) return 2
        else if (color === ItemColor.Gold) return 3
        else if (color === ItemColor.Diamond) return 4
    }

    public async stitchInventory(inventory: IUserLootSeriesInventory, unobtainableSeries?: string) {
        const urls = ['common', 'rare', 'epic', 'legendary']
            .map((rarity) => {
                return inventory[rarity].img as string
            })
            .filter((url) => url && url.length > 0)
        const buffers = await Promise.all(
            urls.map(async (url) => {
                const res = await fetch(url)
                if (!res.ok) throw new Error(`Failed to fetch ${url}`)
                return Buffer.from(await res.arrayBuffer())
            })
        )
        // Get metadata for the first image (all are the same size)
        const { width, height } = await sharp(buffers[0]).metadata()

        // Total canvas height = number of sections × height
        let totalHeight = height * buffers.length
        if (unobtainableSeries && unobtainableSeries.length > 0) {
            const unobtainable = fs.readFileSync(`graphics/background/inventory_parts/unobtainable_${unobtainableSeries}.png`)
            const extra = await sharp(unobtainable).metadata()
            totalHeight += extra.height
            buffers.push(unobtainable)
        }

        // Create a blank canvas
        const base = sharp({
            create: {
                width,
                height: totalHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }, // white background
            },
        }).png()

        // Prepare composite operations
        const composites = buffers.map((img, i) => ({
            input: img,
            top: i * height,
            left: 0,
        }))

        // Stitch together
        return await base.composite(composites).toBuffer()
    }

    public async extractArtSection(art: ILootSeriesInventoryArt, rarity: ItemRarity): Promise<Buffer> {
        // Get original dimensions
        const image = fs.readFileSync(`graphics/background/inventory_art/${art.name}.png`)
        const metadata = await sharp(image).metadata()
        const { width, height } = metadata
        const section = this.resolveRaritySection(rarity)

        // Define the region: top-left corner (0,0), full width, quarter height
        const region = {
            left: 0,
            top: Math.floor((height / 4) * section),
            width: width,
            height: Math.floor(height / 4),
        }

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.floor(height / 4)}">
    <rect width="100%" height="100%" fill="white" fill-opacity="${art.opacity}" />
  </svg>`
        return await sharp(image)
            .ensureAlpha()
            .extract(region)
            .composite([{ input: Buffer.from(svg), blend: 'dest-in' }])
            .toBuffer()
    }

    private resolveRaritySection(rarity: ItemRarity) {
        if (rarity === ItemRarity.Common) return 0
        else if (rarity === ItemRarity.Rare) return 1
        else if (rarity === ItemRarity.Epic) return 2
        else if (rarity === ItemRarity.Legendary) return 3
        return 0
    }

    public async getInventoryBackground(user: MazariniUser, series: ILootSeries, rarity: ItemRarity) {
        const isHP = series.name === 'hp'
        let bg = fs.readFileSync(`graphics/background/inventory_parts/${rarity}${isHP ? '_hp' : ''}.png`)
        if (isHP) return bg
        const artObj: ILootSeriesInventoryArt = user.loot[series.name].inventoryArt
        if (artObj) {
            const art = await this.extractArtSection(artObj, rarity)
            bg = await this.compositeBuffers(bg, art, 0, 0)
        }
        const slots = fs.readFileSync(`graphics/background/inventory_parts/slots.png`)
        return await this.compositeBuffers(bg, slots, 0, 0)
    }

    private async getImageSeriesForCollectables(collectables: IUserLootItem[], imageTemplate: ICollectableImage): Promise<IImage[]> {
        const images: IImage[] = new Array<IImage>()
        // Sort items into rarities and assign a specific coordinate to each
        const commonImages = await this.getImagesForRarity(
            collectables.filter((item) => item.rarity === ItemRarity.Common),
            imageTemplate.common
        )
        images.push(...commonImages)
        const rareImages = await this.getImagesForRarity(
            collectables.filter((item) => item.rarity === ItemRarity.Rare),
            imageTemplate.rare
        )
        images.push(...rareImages)
        const epicImages = await this.getImagesForRarity(
            collectables.filter((item) => item.rarity === ItemRarity.Epic),
            imageTemplate.epic
        )
        images.push(...epicImages)
        const legendaryImages = await this.getImagesForRarity(
            collectables.filter((item) => item.rarity === ItemRarity.Legendary),
            imageTemplate.legendary
        )
        images.push(...legendaryImages)
        return images
    }

    private async getImagesForRarity(collectables: IUserLootItem[], coords: IItemShadowCoordinates[]): Promise<IImage[]> {
        const images: IImage[] = new Array<IImage>()
        let i = 0
        for (const item of collectables) {
            const itemImages = await this.getImagesForSingleCollectable(item, coords[i])
            images.push(...itemImages)
            i++
        }
        return images
    }

    private async getImagesForSingleCollectable(item: IUserLootItem, coord: IItemShadowCoordinates): Promise<IImage[]> {
        const url = await this.getEmojiImageUrl(item)
        const emojiImageBuffer = await this.getPngBufferForWebpUrl(url)
        // const resizedItem = await sharp(emojiImageBuffer).resize({ fit: sharp.fit.inside, width: 75 }).toBuffer()
        const canvas = await getCanvasImage({ buffer: emojiImageBuffer })
        const emojiImageArray: IImage[] = [{ ...this.getImageCoordinates(coord, canvas, 1), canvasImage: canvas }] // Must have layer 1
        const collectableBackground = await this.getItemBackgroundImage(item.color, coord)
        if (collectableBackground) emojiImageArray.push(collectableBackground)
        const inventoryCounter = await this.getItemInventoryImage(item, coord)
        if (inventoryCounter) emojiImageArray.push(inventoryCounter)
        return emojiImageArray
    }

    private async getEmojiImageUrl(item: IUserLootItem, large: boolean = false): Promise<string> {
        const name = this.buildEmojiName(item)
        const emoji = await EmojiHelper.getApplicationEmoji(name, this.client)
        const params = large ? 'size=128&quality=lossless' : 'size=96'
        return `https://cdn.discordapp.com/emojis/${emoji.urlId}.webp?${params}`
    }

    private buildEmojiName(item: IUserLootItem): string {
        return `${item.series}_${item.name}_${item.color.charAt(0)}`.toLowerCase()
    }

    private async getPngBufferForWebpUrl(url: string): Promise<Buffer> {
        const webpImage = await fetch(url)
        const buffer = Buffer.from(await webpImage.arrayBuffer())
        const image = await sharp(buffer).toFormat('png').toBuffer()
        return image
    }

    private async getItemBackgroundImage(color: ItemColor, coord: IItemShadowCoordinates): Promise<IImage> {
        if (color === ItemColor.None) return undefined
        const halo = fs.readFileSync(`graphics/halo_small/${color}.png`)
        const canvas = await getCanvasImage({ buffer: halo })
        return { ...this.getImageCoordinates(coord, canvas, 0), canvasImage: canvas }
    }

    private getImageCoordinates(coord: IItemShadowCoordinates, img: Image, layer: number): IImageCoordinates {
        return {
            layer: layer,
            repeat: 'fit',
            x: coord.centerX - Math.floor(img.width / 2),
            y: coord.centerY - Math.floor(img.height / 2),
            width: img.width,
            height: img.height,
        }
    }

    private async getItemInventoryImage(item: IUserLootItem, coord: IItemShadowCoordinates): Promise<IImage> {
        if (item.amount <= 1) return undefined
        const bg = fs.readFileSync(`graphics/number_bg.png`)
        const resizedBg = await sharp(bg).resize({ fit: sharp.fit.inside, height: 50 }).toBuffer()
        const bgMeta = await sharp(resizedBg).metadata()
        const fontSize = 50
        const amountBuffer = new UltimateTextToImage(`${item.amount}`, {
            fontFamily: 'Work Sans',
            fontColor: '#ffffff',
            fontSize: fontSize,
            fontWeight: 500,
            margin: 2,
        })
            .render()
            .toBuffer()
        const resizedAmount = await sharp(amountBuffer).resize({ fit: sharp.fit.inside, height: 25 }).toBuffer()
        const amountMeta = await sharp(resizedAmount).metadata()
        const amountImage = await sharp(resizedBg)
            .composite([
                { input: resizedAmount, top: Math.floor(bgMeta.height / 2 - amountMeta.height / 2), left: Math.floor(bgMeta.width / 2 - amountMeta.width / 2) },
            ])
            .toBuffer()
        const canvas = await getCanvasImage({ buffer: amountImage })
        const amountCoord = this.getInventoryCoordinates(coord, canvas)
        return { ...amountCoord, canvasImage: canvas }
    }

    // Places the counter in the top right corner of the item
    private getInventoryCoordinates(coord: IItemShadowCoordinates, img: Image): IImageCoordinates {
        return {
            layer: 1,
            repeat: 'fit',
            x: Math.floor(coord.centerX + this.percentage(coord.width, 30) - img.width / 2),
            y: Math.floor(coord.centerY - this.percentage(coord.height, 40) - img.height / 2),
            width: img.width,
            height: img.height,
        }
    }

    private percentage(initialNumber: number, percentage: number): number {
        return Math.ceil((initialNumber / 100) * percentage)
    }
}

export const inventoryTemplate = generateTemplateForSize(1147, 1968, 10, '')
export const splitInventoryTemplate = generateTemplateForSize(1147, 1968, 10, '', true)

function generateTemplateForSize(imageWidth: number, imageHeight: number, horizontalItems: number, backgroundUrl: string, splitInventory = false) {
    const initalX = 63
    const initialY = 194
    const widthToNext = 1019 / 9
    const heightToNextRow = 188
    const heightToNextColor = heightToNextRow + 302
    const commonSection = generateCoordinates(initalX, initialY, widthToNext, heightToNextRow)
    const rareSection = generateCoordinates(initalX, initialY + heightToNextColor, widthToNext, heightToNextRow)
    const epicSection = generateCoordinates(initalX, initialY + 2 * heightToNextColor, widthToNext, heightToNextRow)
    const legendarySection = generateCoordinates(initalX, initialY + 3 * heightToNextColor, widthToNext, heightToNextRow)
    const template: ICollectableImage = {
        backgroundUrl: backgroundUrl,
        options: { width: imageWidth, height: imageHeight / (splitInventory ? 4 : 1) },
        common: commonSection,
        rare: splitInventory ? commonSection : rareSection,
        epic: splitInventory ? commonSection : epicSection,
        legendary: splitInventory ? commonSection : legendarySection,
    }
    return template
}

// Gets the center of shadow-box
function generateCoordinates(initialX: number, initialY: number, widthToNext: number, heightToNext: number) {
    const coordinates: IItemShadowCoordinates[] = new Array<IItemShadowCoordinates>()
    for (let row = 0; row < 2; row++) {
        for (let column = 0; column < 10; column++) {
            coordinates.push({
                centerX: initialX + Math.floor(column * widthToNext),
                centerY: initialY + Math.floor(row * heightToNext),
                width: 101,
                height: 155,
            })
        }
    }
    return coordinates
}

//x:63, y:194  ->  x:1082, y:194
//x:63, y:382
//x:63, y:684
//x:63, y:872
//x:63, y:1174

// 1019 mellom første og siste på en rad
// 188 til neste rad i samme farge
// 302 til neste rad i ny farge
// Math.floor((1019/9)*{kolonnen i raden}) --tar utgangspunkt i 0-index liste
