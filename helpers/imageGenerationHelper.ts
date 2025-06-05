import { Image } from 'canvas'
import sharp from 'sharp'
import { IFontWeight, IImage, IOptions, IRepeat, UltimateTextToImage, getCanvasImage, registerFont } from 'ultimate-text-to-image'
import { MazariniClient } from '../client/MazariniClient'
import { IUserCollectable, ItemColor, ItemRarity } from '../interfaces/database/databaseInterface'
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

const currentSetup: IRevealGifSetup = harry_potter_setup

const inventoryOptions: IImageCoordinates = {
    layer: -1,
    repeat: 'fit',
    x: 0,
    y: 0,
    width: 1147,
    height: 1968,
}

export class ImageGenerationHelper {
    private client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }

    public async generateRevealGifForCollectable(collectable: IUserCollectable): Promise<Buffer> {
        const backgroundWithItem = await this.getBackgroundWithItem(collectable)
        // return backgroundWithItem
        // const lightrayAndText = await this.getLightrayAndText(collectable)
        // const revealBackground = await sharp(backgroundWithItem)
        //     .composite([{ input: lightrayAndText, top: ratios.lightrayTop, left: 0 }])
        //     .toBuffer()
        // const text = await this.getHeaderText(collectable)

        // const revealBackground = await sharp(backgroundWithItem).composite(text).toBuffer()
        // return revealBackground
        const gifBuffer = fs.readFileSync(currentSetup.gif)

        return await this.overlayGif(backgroundWithItem, gifBuffer)
    }

    private async getBackgroundWithItem(collectable: IUserCollectable): Promise<Buffer> {
        const background = fs.readFileSync(`${currentSetup.background}${collectable.name}.png`)
        const resizedBg = await sharp(background)
            .resize({ fit: sharp.fit.cover, width: currentSetup.revealWidth, height: currentSetup.revealHeight })
            .toBuffer()
        const halo = await this.getHalo(collectable.color)
        const item = fs.readFileSync(`graphics/fixed/${collectable.color}/hp_${collectable.name}_${collectable.color.charAt(0)}.png`) //await this.getItemBuffer(collectable)
        const resizedItem = await sharp(item).resize({ fit: sharp.fit.cover, width: 700, height: 700 }).toBuffer()
        let backgroundBuffer = resizedBg
        if (halo) {
            const coords = await currentSetup.ratios.item.coords(halo)
            backgroundBuffer = await this.compositeBuffers(resizedBg, halo, 10 - 50 /*coords.top*/, coords.left)
        }
        const badge = fs.readFileSync(`graphics/badge/badge.png`)
        const resizedBadge = await sharp(badge).resize({ fit: sharp.fit.cover, width: 160 }).toBuffer()
        const badgeHalo = this.getRarityHalo(collectable.rarity)
        const badgeWithHalo = await this.compositeBuffers(badgeHalo, resizedBadge, 100, 120)
        const coords = await currentSetup.ratios.item.coords(resizedItem)
        const img = await this.compositeBuffers(backgroundBuffer, resizedItem, coords.top + (collectable.name === 'madeye' ? 150 : 120), coords.left)
        return await this.compositeBuffers(img, badgeWithHalo, 400, 660)
    }

    private async getHalo(color: ItemColor): Promise<Buffer> {
        const halo = fs.readFileSync(`graphics/halo/${color}.png`)
        return await this.resize(halo, false, 720)
    }

    private getRarityHalo(rarity: ItemRarity): Buffer {
        let color = ''
        if (rarity === ItemRarity.Common) color = 'yellow'
        else if (rarity === ItemRarity.Rare) color = 'blue'
        else if (rarity === ItemRarity.Epic) color = 'green'
        else color = 'red'
        return fs.readFileSync(`graphics/halo/${color}.png`)
    }

    private async getItemBuffer(collectable: IUserCollectable): Promise<Buffer> {
        const itemUrl = await this.getEmojiImageUrl(collectable, true)
        const item = await fetch(itemUrl)
        const itemBuffer = Buffer.from(await item.arrayBuffer())
        return await this.resize(itemBuffer, false, currentSetup.ratios.item.size)
    }

    private async getLightrayAndText(collectable: IUserCollectable): Promise<Buffer> {
        const lightray = fs.readFileSync(`graphics/lightray/${collectable.rarity}.png`)
        const resizedLightray = sharp(lightray)
            .resize({ fit: sharp.fit.cover, width: currentSetup.ratios.rarityEffect.scaleWidth })
            .resize({ fit: sharp.fit.cover, width: currentSetup.revealWidth, height: currentSetup.ratios.rarityEffect.scaleHeight })
        const text = await this.getHeaderText(collectable)

        const lr = await resizedLightray.toBuffer()
        return sharp(lr).composite(text).toBuffer()
    }

    private async getHeaderText(collectable: IUserCollectable): Promise<sharp.OverlayOptions[]> {
        registerFont(currentSetup.font.path, { family: currentSetup.font.family, weight: currentSetup.font.weight })
        const fontSize = 50
        const header = `${TextUtils.formatRevealGifString(collectable.name)}`
        const itemHeader = new UltimateTextToImage(header, {
            fontFamily: currentSetup.font.family,
            fontColor: currentSetup.font.primaryColor,
            fontSize: fontSize,
            fontWeight: currentSetup.font.weight,
            margin: 2,
        })
            .render()
            .toBuffer()
        const resizedHeader = await sharp(itemHeader).resize({ fit: sharp.fit.inside, height: currentSetup.ratios.textHeight }).toBuffer()
        // legendary: '#d1700f'
        // epic: '#7223cc'
        const outline = new UltimateTextToImage(header, {
            fontFamily: currentSetup.font.family,
            fontColor: '#f5e12f', // //currentSetup.font.outlineColor, //'#f55525', //
            fontSize: fontSize,
            fontWeight: currentSetup.font.weight,
            margin: 2,
        })
            .render()
            .toBuffer()
        const resizedOutline = await sharp(outline).resize({ fit: sharp.fit.inside, height: currentSetup.ratios.textHeight }).toBuffer()
        const headerMeta = await sharp(resizedHeader).metadata()
        const top = Math.floor(420 - headerMeta.height / 2)
        const left = Math.floor(474 - headerMeta.width / 2)
        return this.getOutlineText(resizedHeader, resizedOutline, top - 40, left, 2)
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
            { delay: new Array(metadata.delay.length).fill(50), loop: 1, effort: 0 }
            //Just copying the metadata from the gif to the output format (not sure this is necessary).
        )

        const resInfo = await result.toBuffer()
        return resInfo
    }

    public async generateImageForCollectables(collectables: IUserCollectable[]): Promise<Buffer> {
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

    private async getImageSeriesForCollectables(collectables: IUserCollectable[], imageTemplate: ICollectableImage): Promise<IImage[]> {
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

    private async getImagesForRarity(collectables: IUserCollectable[], coords: IItemShadowCoordinates[]): Promise<IImage[]> {
        const images: IImage[] = new Array<IImage>()
        let i = 0
        for (const item of collectables) {
            const itemImages = await this.getImagesForSingleCollectable(item, coords[i])
            images.push(...itemImages)
            i++
        }
        return images
    }

    private async getImagesForSingleCollectable(item: IUserCollectable, coord: IItemShadowCoordinates): Promise<IImage[]> {
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

    private async getEmojiImageUrl(item: IUserCollectable, large: boolean = false): Promise<string> {
        const name = this.buildEmojiName(item)
        const emoji = await EmojiHelper.getApplicationEmoji(name, this.client)
        const params = large ? 'size=128&quality=lossless' : 'size=96'
        return `https://cdn.discordapp.com/emojis/${emoji.urlId}.webp?${params}`
    }

    private buildEmojiName(item: IUserCollectable): string {
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

    private async getItemInventoryImage(item: IUserCollectable, coord: IItemShadowCoordinates): Promise<IImage> {
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

function generateTemplateForSize(imageWidth: number, imageHeight: number, horizontalItems: number, backgroundUrl: string) {
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
        options: { width: imageWidth, height: imageHeight },
        common: commonSection,
        rare: rareSection,
        epic: epicSection,
        legendary: legendarySection,
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
