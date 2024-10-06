import { Image } from 'canvas'
import sharp from 'sharp'
import { IImage, IOptions, IRepeat, UltimateTextToImage, getCanvasImage, registerFont } from 'ultimate-text-to-image'
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

const revealWidth: number = 960
const revealHeight: number = 720

const ratios = {
    halo: Math.floor(revealHeight * 0.85),
    lightrayScaleWidth: Math.floor(revealWidth * 1.25),
    lightrayScaleHeight: Math.floor(revealHeight * 0.8),
    item: Math.floor(revealHeight * 0.5),
    textHeight: Math.floor(revealHeight * 0.056),
    itemCoords: async (item: Buffer) => {
        const meta = await sharp(item).metadata()
        const top = Math.floor(revealHeight / 2.5 - meta.height / 2)
        const left = Math.floor(revealWidth / 2 - meta.width / 2)
        return { top: top, left: left }
    },
    itemTop: async (item: Buffer) => {
        const meta = await sharp(item).metadata()
        return Math.floor(revealHeight / 2 - meta.height / 2)
    },
    itemLeft: async (item: Buffer) => {
        const meta = await sharp(item).metadata()
        return Math.floor(revealWidth / 2 - meta.width / 2)
    },
    itemTopWithHalo: Math.floor(revealHeight / 4 - (revealHeight * 0.35) / 2),
    itemLeftWithHalo: Math.floor(revealWidth / 2 - (revealHeight / 4 - (revealHeight * 0.35) / 2)),
    lightrayTop: Math.floor(revealHeight * 0.35),
}

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

        this.addFonts()
    }

    private addFonts() {
        registerFont('graphics/fonts/WorkSans-Medium.ttf', { family: 'Work Sans', weight: 500 })
    }

    public async generateRevealGifForCollectable(collectable: IUserCollectable): Promise<Buffer> {
        const backgroundWithItem = await this.getBackgroundWithItem(collectable)
        const lightrayAndText = await this.getLightrayAndText(collectable)
        const revealBackground = await sharp(backgroundWithItem)
            .composite([{ input: lightrayAndText, top: ratios.lightrayTop, left: 0 }])
            .toBuffer()
        const gifUrl = 'graphics/sf_kino.gif'
        const gifBuffer = fs.readFileSync(gifUrl)

        return await this.overlayGif(revealBackground, gifBuffer)
    }

    private async getBackgroundWithItem(collectable: IUserCollectable): Promise<Buffer> {
        const color = this.getColorForNewItem(collectable)
        const background = fs.readFileSync('graphics/background.png')
        const resizedBg = await sharp(background).resize({ fit: sharp.fit.cover, width: revealWidth, height: revealHeight }).toBuffer()
        const halo = await this.getHalo(color)
        const item = await this.getItemBuffer(collectable, color)
        let backgroundBuffer = resizedBg
        if (halo) {
            const coords = await ratios.itemCoords(halo)
            backgroundBuffer = await this.compositeBuffers(resizedBg, halo, coords.top, coords.left)
        }
        const coords = await ratios.itemCoords(item)
        return await this.compositeBuffers(backgroundBuffer, item, coords.top, coords.left)
    }

    private async getHalo(color: ItemColor): Promise<Buffer> {
        if (color === ItemColor.None) return undefined
        const halo = fs.readFileSync(`graphics/halo/${color}.png`)
        return await this.resize(halo, false, ratios.halo)
    }

    private async getItemBuffer(collectable: IUserCollectable, color: ItemColor): Promise<Buffer> {
        const itemUrl = await this.getEmojiImageUrl(collectable, color)
        const item = await fetch(itemUrl)
        const itemBuffer = Buffer.from(await item.arrayBuffer())
        return await this.resize(itemBuffer, false, ratios.item)
    }

    private async getLightrayAndText(collectable: IUserCollectable): Promise<Buffer> {
        const lightray = fs.readFileSync(`graphics/lightray/${collectable.rarity}.png`)
        const resizedLightray = sharp(lightray)
            .resize({ fit: sharp.fit.cover, width: ratios.lightrayScaleWidth })
            .resize({ fit: sharp.fit.cover, width: revealWidth, height: ratios.lightrayScaleHeight })
        const meta = await resizedLightray.metadata()
        const text = await this.getHeaderText(collectable, meta)
        const lr = await resizedLightray.toBuffer()
        return sharp(lr).composite(text).toBuffer()
    }

    private async getHeaderText(collectable: IUserCollectable, meta: sharp.Metadata): Promise<sharp.OverlayOptions[]> {
        registerFont('graphics/fonts/WorkSans-Medium.ttf', { family: 'Work Sans', weight: 500 })
        const fontSize = 50
        const header = `${TextUtils.capitalizeFirstLetter(collectable.name)}`
        const itemHeader = new UltimateTextToImage(header, { fontFamily: 'Work Sans', fontColor: '#ffffff', fontSize: fontSize, fontWeight: 500, margin: 2 })
            .render()
            .toBuffer()
        const resizedHeader = await sharp(itemHeader).resize({ fit: sharp.fit.inside, height: ratios.textHeight }).toBuffer()

        const outline = new UltimateTextToImage(header, { fontFamily: 'Work Sans', fontColor: '#000000', fontSize: fontSize, fontWeight: 500, margin: 2 })
            .render()
            .toBuffer()
        const resizedOutline = await sharp(outline).resize({ fit: sharp.fit.inside, height: ratios.textHeight }).toBuffer()
        const headerMeta = await sharp(resizedHeader).metadata()
        const top = Math.floor(292 - headerMeta.height / 2)
        const left = Math.floor(474 - headerMeta.width / 2)
        return this.getOutlineText(resizedHeader, resizedOutline, top, left, 2)
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

    private async compositeBuffers(background: Buffer, overlay: Buffer, top?: number, left?: number): Promise<Buffer> {
        return sharp(background)
            .composite([{ input: overlay, gravity: 'center', top: top, left: left }])
            .toBuffer()
    }

    private getOutlineText(text: Buffer, outline: Buffer, topOffset: number, leftOffset: number, layers: number): sharp.OverlayOptions[] {
        let texts: sharp.OverlayOptions[] = new Array<sharp.OverlayOptions>()
        for (let x = -layers; x <= layers; x++) {
            for (let y = -layers; y <= layers; y++) {
                texts.push({ input: outline, top: topOffset + x, left: leftOffset + y })
            }
        }
        texts.push({ input: text, top: topOffset, left: leftOffset })
        return texts
    }

    private async overlayGif(background: Buffer, gifOverlay: Buffer) {
        //takes two input paths.
        const overlay = sharp(gifOverlay, { animated: true }) //make sure animated is true.
        const metadata = await overlay.metadata() //We'll use the gif metadata to normalize the background.
        const backgroundImg = sharp(background).resize(metadata.width, metadata.pageHeight) //We are resizing here to normalize background with gif.
        const imgRoll = backgroundImg.extend({ bottom: metadata.pageHeight * (metadata.pages - 1), extendWith: 'repeat' }) //Must extend to repeat how ever many pages (frames) are in the gif.

        const result = imgRoll.composite([{ input: await overlay.toBuffer(), gravity: 'north', animated: true }]).gif(
            { progressive: metadata.isProgressive, delay: metadata.delay, loop: 1, effort: 1 }
            //Just copying the metadata from the gif to the output format (not sure this is necessary).
        )

        const resInfo = await result.toBuffer()
        return resInfo
    }

    public async generateImageForCollectables(collectables: IUserCollectable[]): Promise<Buffer> {
        const background = fs.readFileSync(`graphics/inventory_bg.png`) 
        if (!collectables) return background
        const canvas = await getCanvasImage({buffer: background}) 
        const imageTemplate: ICollectableImage = inventoryTemplate
        const images = await this.getImageSeriesForCollectables(collectables, imageTemplate)
        images.push({...inventoryOptions, canvasImage: canvas})
        const collection = new UltimateTextToImage("", {...imageTemplate.options, images: images}).render().toBuffer()
        return collection
    }

    private async getImageSeriesForCollectables(collectables: IUserCollectable[], imageTemplate: ICollectableImage): Promise<IImage[]> {
        let images: IImage[] = new Array<IImage>()
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
        let images: IImage[] = new Array<IImage>()
        let i = 0
        for (const item of collectables) {
            const collectedColors = this.getNumberOfColorsCollected(item)
            const itemImages = await this.getImagesForAllCollectableColors(item, coords.slice(i, i + collectedColors))
            images.push(...itemImages)
            i += collectedColors
        }
        return images
    }

    private async getImagesForAllCollectableColors(item: IUserCollectable, coords: IItemShadowCoordinates[]): Promise<IImage[]> {
        let images: IImage[] = new Array<IImage>()
        let i = 0
        if (item.inventory.none > 0) {
            const noneImages = await this.getImagesForSingleCollectable(item, ItemColor.None, coords[i])
            images.push(...noneImages)
            i++
        }
        if (item.inventory.silver > 0) {
            const noneImages = await this.getImagesForSingleCollectable(item, ItemColor.Silver, coords[i])
            images.push(...noneImages)
            i++
        }
        if (item.inventory.gold > 0) {
            const noneImages = await this.getImagesForSingleCollectable(item, ItemColor.Gold, coords[i])
            images.push(...noneImages)
            i++
        }
        if (item.inventory.diamond > 0) {
            const noneImages = await this.getImagesForSingleCollectable(item, ItemColor.Diamond, coords[i])
            images.push(...noneImages)
            i++
        }
        return images
    }

    private async getImagesForSingleCollectable(item: IUserCollectable, color: ItemColor, coord: IItemShadowCoordinates): Promise<IImage[]> {
        const url = await this.getEmojiImageUrl(item, color)
        const emojiImageBuffer = await this.getPngBufferForWebpUrl(url)
        const resizedItem = await sharp(emojiImageBuffer).resize({ fit: sharp.fit.inside, width: 75 }).toBuffer()
        const canvas = await getCanvasImage({ buffer: resizedItem })
        let emojiImageArray: IImage[] = [{ ...this.getImageCoordinates(coord, canvas, 1), canvasImage: canvas }] // Must have layer 1
        const collectableBackground = await this.getItemBackgroundImage(color, coord)
        if (collectableBackground) emojiImageArray.push(collectableBackground)
        const inventoryCounter = await this.getItemInventoryImage(item, color, coord)
        if (inventoryCounter) emojiImageArray.push(inventoryCounter)
        return emojiImageArray
    }

    private async getEmojiImageUrl(item: IUserCollectable, color: ItemColor): Promise<string> {
        const name = this.buildEmojiName(item, color)
        const emoji = await EmojiHelper.getApplicationEmoji(name, this.client)
        return `https://cdn.discordapp.com/emojis/${emoji.urlId}.webp?size=96&quality=lossless`
    }

    private buildEmojiName(item: IUserCollectable, color: ItemColor): string {
        return `${item.series}_${item.name}_${color.charAt(0)}`.toLowerCase()
    }

    private async getPngBufferForWebpUrl(url: string): Promise<Buffer> {
        let webpImage = await fetch(url)
        let buffer = Buffer.from(await webpImage.arrayBuffer())
        const image = await sharp(buffer).toFormat('png').toBuffer()
        return image
    }

    private async getItemBackgroundImage(color: ItemColor, coord: IItemShadowCoordinates): Promise<IImage> {
        if (color === ItemColor.None) return undefined
        const halo = fs.readFileSync(`graphics/halo/${color}.png`)
        const resizedHalo = await this.resize(halo, false, 150)
        const canvas = await getCanvasImage({ buffer: resizedHalo })
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

    private async getItemInventoryImage(item: IUserCollectable, color: ItemColor, coord: IItemShadowCoordinates): Promise<IImage> {
        const amount = this.getInventoryForColor(item, color)
        if (amount <= 1) return undefined
        const bg = fs.readFileSync(`graphics/number_bg.png`)
        const resizedBg = await sharp(bg).resize({ fit: sharp.fit.inside, height: 50 }).toBuffer()
        const bgMeta = await sharp(resizedBg).metadata()
        const fontSize = 50
        const amountBuffer = new UltimateTextToImage(`${amount}`, {
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

    private getInventoryForColor(item: IUserCollectable, color: ItemColor): number {
        if (color === ItemColor.None) return item.inventory.none
        else if (color === ItemColor.Silver) return item.inventory.silver
        else if (color === ItemColor.Gold) return item.inventory.gold
        else if (color === ItemColor.Diamond) return item.inventory.diamond
        else return 0
    }

    private getColorForNewItem(item: IUserCollectable): ItemColor {
        if (item.inventory.diamond === 1) return ItemColor.Diamond
        else if (item.inventory.gold === 1) return ItemColor.Gold
        else if (item.inventory.silver === 1) return ItemColor.Silver
        else return ItemColor.None
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

    private getNumberOfColorsCollected(item: IUserCollectable): number {
        let counter = 0
        counter += item.inventory.none > 0 ? 1 : 0
        counter += item.inventory.silver > 0 ? 1 : 0
        counter += item.inventory.gold > 0 ? 1 : 0
        counter += item.inventory.diamond > 0 ? 1 : 0
        return counter
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
    let coordinates: IItemShadowCoordinates[] = new Array<IItemShadowCoordinates>()
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
