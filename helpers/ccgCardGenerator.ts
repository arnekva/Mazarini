import * as crypto from 'crypto'
import { ApplicationEmoji, Collection } from 'discord.js'
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { MazariniClient } from '../client/MazariniClient'
import { hpCCG } from '../commands/ccg/cards/hpCCG'
import { mazariniCCG } from '../commands/ccg/cards/mazariniCCG'
import { swCCG } from '../commands/ccg/cards/swCCG'
import { CardIdentifier, CCGCard, CCGCardEffect, CCGCondition } from '../commands/ccg/ccgInterface'
import { ItemRarity } from '../interfaces/database/databaseInterface'
import { ArrayUtils } from '../utils/arrayUtils'

const CARD_WIDTH = 480
const CARD_HEIGHT = 672
const OUTPUT_DIR = path.resolve('res/ccg/generated')
const HASH_FILE = path.resolve('res/ccg/generated/.hashes.json')
const BLANKS_DIR = path.resolve('res/ccg/blanks')

/** Series whose application emoji names match the card ID exactly (no series prefix) */
const SERIES_EMOJI_IS_ID = new Set(['swCCG', 'hpCCG'])

/** Map rarity to its blank background filename */
const RARITY_BLANK: Record<string, string> = {
    [ItemRarity.Common]: 'mazarini_common_blank.png',
    [ItemRarity.Rare]: 'mazarini_rare_blank.png',
    [ItemRarity.Epic]: 'mazarini_epic_blank.png',
    [ItemRarity.Legendary]: 'mazarini_legendary_blank.png',
}

/** Per-series border width in pixels. The card content is scaled down to fit inside the border. */
const SERIES_CARD_BORDER: Record<string, number> = {
    hpCCG: 12,
}
const BORDER_OUTER_RADIUS = 18
const BORDER_INNER_RADIUS = 10

/** Per-series rarity blank overrides */
const SERIES_RARITY_BLANK: Record<string, Record<string, string>> = {
    hpCCG: {
        [ItemRarity.Common]: 'hp/hp_common_blank.png',
        [ItemRarity.Rare]: 'hp/hp_rare_blank.png',
        [ItemRarity.Epic]: 'hp/hp_epic_blank.png',
        [ItemRarity.Legendary]: 'hp/hp_legendary_blank.png',
    },
    swCCG: {
        [ItemRarity.Common]: 'sw/sw_common_blank.png',
        [ItemRarity.Rare]: 'sw/sw_rare_blank.png',
        [ItemRarity.Epic]: 'sw/sw_epic_blank.png',
        [ItemRarity.Legendary]: 'sw/sw_legendary_blank.png',
    },
}

/** Resolve the blank filename for a card based on its series and rarity */
const getBlankFile = (card: CCGCard): string => SERIES_RARITY_BLANK[card.series]?.[card.rarity] ?? RARITY_BLANK[card.rarity] ?? RARITY_BLANK[ItemRarity.Common]

/** Description text colors */
const RED = '#ef4444'
const GREEN = '#52B329'
const BLUE = '#60a5fa'
const PINK = '#E668A7'
const YELLOW = '#F5C542'
const WHITE = 'white'

/** BBCode tag → color mapping */
const TAG_COLORS: Record<string, string> = {
    red: RED,
    green: GREEN,
    blue: BLUE,
    pink: PINK,
    yellow: YELLOW,
    white: WHITE,
}

/** Identifier → pill background color */
const IDENTIFIER_COLORS: Record<string, string> = {
    JEDI: '#60a5fa',
    SITH: '#ef4444',
    REBEL: '#52B329',
    EMPIRE: '#888888',
    BOUNTY_HUNTER: '#F5C542',
    CREATURE: '#8B4513',
    DROID: '#00BCD4',
    REPUBLIC: '#9b59b6',
    GRYFFINDOR: '#ae0001',
    SLYTHERIN: '#1a472a',
    RAVENCLAW: '#222f5b',
    HUFFLEPUFF: '#ecb939',
    DEATH_EATER: '#333333',
    SEEKER: '#c0a000',
    MAGICAL_CREATURE: '#6b3a2a',
    HOUSE_ELF: '#7a7a7a',
}

// Layout constants for 480x672 card (pixel-matched to blank templates)
// Keep emoji art strictly inside this square with padding.
const ART_BOUND_LEFT = 98
const ART_BOUND_TOP = 60
const ART_BOUND_RIGHT = 384
const ART_BOUND_BOTTOM = 346
const ART_PADDING = 15
const ART_CENTER_X = 241
const ART_CENTER_Y = 203
const ART_MAX_SIZE = Math.min(ART_BOUND_RIGHT - ART_BOUND_LEFT, ART_BOUND_BOTTOM - ART_BOUND_TOP) - ART_PADDING * 2
const ART_SCALE = 0.95
/** Bump this whenever layout constants change to force card regeneration */
const LAYOUT_VERSION = 53

/** Effect types that are implicit/mechanical and should not appear in card description text */
const IMPLICIT_EFFECT_TYPES = new Set(['CLAIM_BOUNTY'])

const SPEED_X = 57
const SPEED_Y = 452
const COST_X = 240
const COST_Y = 422
const ACCURACY_X = 439
const ACCURACY_Y = 452
const NAME_X = 238
const NAME_Y = 495
const DESC_X = 240
const DESC_START_Y = 592

let _isReady = false
/** Processed (resized + rounded) art buffers cached during generateAll, keyed by card id */
const artCache = new Map<string, { buffer: Buffer; width: number; height: number }>()

/** A stat/value modification to apply when rendering a card image on the fly */
export interface CardModification {
    type: 'COST_DELTA' | 'DAMAGE_DELTA' | 'HEAL_DELTA' | 'ENERGY_DELTA' | 'SPEED_DELTA' | 'SPEED_MULTIPLIER' | 'ACCURACY_DELTA' | 'ACCURACY_OVERRIDE'
    value: number
    /** If set, this modification only applies to cards that have this identifier */
    identifier?: CardIdentifier
}

export class CCGCardGenerator {
    /** Returns true if card generation is complete and CCG games can be started */
    static get isReady(): boolean {
        return _isReady
    }

    /** Generate all card images. Only regenerates cards whose data has changed. */
    static async generateAll(client: MazariniClient, cards?: CCGCard[]): Promise<void> {
        _isReady = false
        const totalStart = Date.now()
        client.messageHelper.sendLogMessage('[CCG] Starting card image generation...')

        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true })
        }

        // Fetch all application emojis once
        const fetchStart = Date.now()
        const appEmojis = await client.application.emojis.fetch()
        const fetchElapsed = ((Date.now() - fetchStart) / 1000).toFixed(2)
        client.messageHelper.sendLogMessage(`[CCG] Fetched ${appEmojis.size} application emojis in ${fetchElapsed}s`)

        const existingHashes = CCGCardGenerator.loadHashes()
        let generated = 0
        let skipped = 0
        const changedSeries = new Set<string>()

        const rawCards = cards ?? [...mazariniCCG, ...swCCG, ...hpCCG]
        const badCount = rawCards.filter((c) => !c).length
        if (badCount > 0)
            client.messageHelper.sendLogMessage(`[CCG] Warning: ${badCount} null/undefined card(s) skipped. Source: ${cards ? 'DB' : 'local'} (${rawCards.length} total)`)
        const allCards = rawCards.filter(Boolean) as CCGCard[]
        const genStart = Date.now()
        for (const card of allCards) {
            const hash = CCGCardGenerator.hashCard(card)
            const outputPath = CCGCardGenerator.getCardPath(card)

            if (existingHashes[card.id] === hash && fs.existsSync(outputPath)) {
                // Still populate the art cache even for unchanged cards
                await CCGCardGenerator.cacheArt(card, appEmojis)
                skipped++
                continue
            }
            if (!changedSeries.has(card.series)) changedSeries.add(card.series)
            await CCGCardGenerator.generateCardImage(card, outputPath, appEmojis)
            existingHashes[card.id] = hash
            generated++
        }
        const genElapsed = ((Date.now() - genStart) / 1000).toFixed(2)

        CCGCardGenerator.saveHashes(existingHashes)
        const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(2)

        client.messageHelper.sendLogMessage(
            `[CCG] Card generation complete in ${totalElapsed}s (emoji fetch: ${fetchElapsed}s, generation: ${genElapsed}s). Generated: ${generated}, Skipped: ${skipped}`
        )
        _isReady = true
        for (const series of changedSeries) this.generateCollage(client, series)
    }

    static async generateCollage(client: MazariniClient, series: string): Promise<void> {
        const { ImageGenerationHelper } = require('./imageGenerationHelper') as typeof import('./imageGenerationHelper')
        const igh = new ImageGenerationHelper(client)
        const totalStart = Date.now()
        client.messageHelper.sendLogMessage('[CCG] Starting series collage generation...')

        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true })
        }

        let cards: CCGCard[] = undefined
        switch (series) {
            case 'mazariniCCG':
                cards = mazariniCCG
                break
            case 'swCCG':
                cards = swCCG
                break
            case 'hpCCG':
                cards = hpCCG
                break
            default:
                cards = mazariniCCG
                break
        }

        const sortOrder: Record<ItemRarity, number> = {
            [ItemRarity.Common]: 0,
            [ItemRarity.Rare]: 1,
            [ItemRarity.Epic]: 2,
            [ItemRarity.Legendary]: 3,
            [ItemRarity.Unobtainable]: 4,
        }
        cards.sort((a, b) => sortOrder[a.rarity] - sortOrder[b.rarity])
        if (!cards || cards.length === 0) return undefined
        const buffers = await Promise.all(
            cards.map(async (card) => {
                return Buffer.from(await CCGCardGenerator.getCardBuffer(card))
            })
        )

        const bufferChunks = ArrayUtils.chunkArray<Buffer>(buffers, 8)

        const stitchedBuffers = await Promise.all(
            bufferChunks.map(async (chunk) => {
                return Buffer.from(await igh.stitchImages(chunk, 'horizontal'))
            })
        )
        const fullImage = await igh.stitchImages(stitchedBuffers, 'vertical')
        const outputPath = this.getCollagePath(series)
        await fs.promises.writeFile(outputPath, fullImage)

        const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(2)

        client.messageHelper.sendLogMessage(`[CCG] Series collage generation complete in ${totalElapsed}s`)
        return
    }

    /** Get the local file path for a generated card image */
    static getCardPath(card: CCGCard): string {
        const seriesDir = path.resolve(OUTPUT_DIR, card.series)
        if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true })
        return path.resolve(seriesDir, `${card.id}_small.png`)
    }

    static getCollagePath(series: string): string {
        const seriesDir = path.resolve(OUTPUT_DIR, series)
        if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true })
        return path.resolve(seriesDir, `pokedex.png`)
    }

    /** Read a generated card image as a Buffer */
    static async getCardBuffer(card: CCGCard): Promise<Buffer> {
        const cardPath = CCGCardGenerator.getCardPath(card)
        return await fs.promises.readFile(cardPath)
    }

    static async getSeriesCollage(client: MazariniClient, series: string): Promise<Buffer> {
        const collagePath = this.getCollagePath(series)
        if (!fs.existsSync(collagePath)) await this.generateCollage(client, series)
        return await fs.promises.readFile(collagePath)
    }

    /**
     * Generate a modified card image to an in-memory Buffer without saving to disk.
     * Uses cached art from the last generateAll run. Falls back to the unmodified card file
     * if no art is cached (e.g. bot just restarted and generation hasn't run yet).
     */
    static async getModifiedCardBuffer(card: CCGCard, mods: CardModification[]): Promise<Buffer> {
        const modified = CCGCardGenerator.applyModifications(card, mods)
        const richSpans = CCGCardGenerator.buildRichDescription(modified)

        const blankFile = getBlankFile(card)
        const blankPath = path.resolve(BLANKS_DIR, blankFile)
        const base = sharp(blankPath).resize(CARD_WIDTH, CARD_HEIGHT).png()
        const layers: sharp.OverlayOptions[] = []

        const cached = artCache.get(card.id)
        if (cached) {
            const minLeft = ART_BOUND_LEFT + ART_PADDING
            const minTop = ART_BOUND_TOP + ART_PADDING
            const maxLeft = ART_BOUND_RIGHT - ART_PADDING - cached.width
            const maxTop = ART_BOUND_BOTTOM - ART_PADDING - cached.height
            const centeredLeft = ART_CENTER_X - Math.floor(cached.width / 2)
            const centeredTop = ART_CENTER_Y - Math.floor(cached.height / 2)
            const artLeft = Math.max(minLeft, Math.min(maxLeft, centeredLeft))
            const artTop = Math.max(minTop, Math.min(maxTop, centeredTop))
            layers.push({ input: cached.buffer, top: artTop, left: artLeft })
        }

        const overlaySvg = CCGCardGenerator.buildOverlaySVG(modified, richSpans, card.cost, card.speed, card.accuracy)
        layers.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 })

        const baseBuffer = await base.toBuffer()
        const fullCard = await sharp(baseBuffer).composite(layers).png().toBuffer()
        const borderWidth = SERIES_CARD_BORDER[card.series]
        return borderWidth ? CCGCardGenerator.applyCardBorder(fullCard, borderWidth) : fullCard
    }

    /** Apply a list of modifications to a deep copy of a card */
    private static applyModifications(card: CCGCard, mods: CardModification[]): CCGCard {
        const c = structuredClone(card)
        const effects = c.effects ?? []
        // Apply overrides first, then deltas
        for (const mod of mods) {
            if (mod.type === 'ACCURACY_OVERRIDE') c.accuracy = mod.value
        }
        for (const mod of mods) {
            if (mod.identifier && !c.identifier?.includes(mod.identifier)) continue
            switch (mod.type) {
                case 'COST_DELTA':
                    c.cost = Math.max(0, c.cost + mod.value)
                    break
                case 'DAMAGE_DELTA':
                    for (const effect of effects) {
                        if (effect.type === 'DAMAGE' && effect.value !== undefined) {
                            effect.value = Math.max(0, effect.value + mod.value)
                        }
                    }
                    break
                case 'HEAL_DELTA':
                    for (const effect of effects) {
                        if (effect.type === 'HEAL' && effect.value !== undefined) {
                            effect.value = Math.max(0, effect.value + mod.value)
                        }
                    }
                    break
                case 'ENERGY_DELTA':
                    for (const effect of effects) {
                        if ((effect.type === 'GAIN_ENERGY' || effect.type === 'LOSE_ENERGY') && effect.value !== undefined) {
                            effect.value = Math.max(0, effect.value + mod.value)
                        }
                    }
                    break
                case 'SPEED_DELTA':
                    c.speed = Math.max(0, c.speed + mod.value)
                    break
                case 'SPEED_MULTIPLIER':
                    c.speed = Math.floor(c.speed * mod.value)
                    break
                case 'ACCURACY_DELTA':
                    c.accuracy = Math.min(100, Math.max(0, c.accuracy + mod.value))
                    break
            }
        }
        return c
    }

    private static hashCard(card: CCGCard): string {
        const data = JSON.stringify({
            _layoutVersion: LAYOUT_VERSION,
            _artLayout: {
                left: ART_BOUND_LEFT,
                top: ART_BOUND_TOP,
                right: ART_BOUND_RIGHT,
                bottom: ART_BOUND_BOTTOM,
                padding: ART_PADDING,
                centerX: ART_CENTER_X,
                centerY: ART_CENTER_Y,
                maxSize: ART_MAX_SIZE,
            },
            id: card.id,
            name: card.name,
            series: card.series,
            type: card.type,
            effects: card.effects,
            cost: card.cost,
            rarity: card.rarity,
            accuracy: card.accuracy,
            speed: card.speed,
            cannotMiss: card.cannotMiss,
            identifier: card.identifier,
            effectImmunities: card.effectImmunities,
            customDescription: card.customDescription,
        })
        return crypto.createHash('md5').update(data).digest('hex')
    }

    private static loadHashes(): Record<string, string> {
        if (fs.existsSync(HASH_FILE)) {
            return JSON.parse(fs.readFileSync(HASH_FILE, 'utf-8'))
        }
        return {}
    }

    private static saveHashes(hashes: Record<string, string>): void {
        fs.writeFileSync(HASH_FILE, JSON.stringify(hashes, null, 2))
    }

    static clearHashes(): void {
        if (fs.existsSync(HASH_FILE)) fs.unlinkSync(HASH_FILE)
        artCache.clear()
    }

    /** Fetch, resize and round-clip art for a card, storing it in the art cache */
    private static async cacheArt(card: CCGCard, appEmojis: Collection<string, ApplicationEmoji>): Promise<void> {
        if (artCache.has(card.id)) return
        const artBuffer = await CCGCardGenerator.fetchEmojiArt(card, appEmojis)
        if (!artBuffer) return
        // Trim transparent canvas margins first so visual content is truly centered.
        const trimmedArt = await sharp(artBuffer).trim().png().toBuffer()
        // Then scale down by 5% inside the allowed max size.
        const targetSize = Math.max(1, Math.floor(ART_MAX_SIZE * ART_SCALE))
        const resizedArt = await sharp(trimmedArt).resize(targetSize, targetSize, { fit: 'inside' }).png().toBuffer()
        const meta = await sharp(resizedArt).metadata()
        const actualW = meta.width ?? targetSize
        const actualH = meta.height ?? targetSize
        const roundedArt = await sharp(resizedArt)
            .composite([
                {
                    input: Buffer.from(
                        `<svg width="${actualW}" height="${actualH}"><rect x="0" y="0" width="${actualW}" height="${actualH}" rx="12" ry="12" fill="white"/></svg>`
                    ),
                    blend: 'dest-in',
                },
            ])
            .png()
            .toBuffer()
        artCache.set(card.id, { buffer: roundedArt, width: actualW, height: actualH })
    }

    /** Fetch an emoji image from Discord CDN as a Buffer */
    private static async fetchEmojiArt(card: CCGCard, appEmojis: Collection<string, ApplicationEmoji>): Promise<Buffer | undefined> {
        const emojiName = card.emoji ?? (SERIES_EMOJI_IS_ID.has(card.series) ? card.id : `${card.series}_${card.id}`)
        const emoji = appEmojis.find((e) => e.name === emojiName)
        if (!emoji) {
            console.warn(`[CCG] No emoji found for ${emojiName}`)
            return undefined
        }
        const url = `https://cdn.discordapp.com/emojis/${encodeURIComponent(emoji.id)}.png?size=128`
        const response = await fetch(url)
        if (!response.ok) {
            console.warn(`[CCG] Failed to fetch emoji image for ${emojiName}: ${response.status}`)
            return undefined
        }
        return Buffer.from(await response.arrayBuffer())
    }

    private static async generateCardImage(card: CCGCard, outputPath: string, appEmojis: Collection<string, ApplicationEmoji>): Promise<void> {
        const richSpans = CCGCardGenerator.buildRichDescription(card)

        // Load the blank background based on series + rarity
        const blankFile = getBlankFile(card)
        const blankPath = path.resolve(BLANKS_DIR, blankFile)
        const base = sharp(blankPath).resize(CARD_WIDTH, CARD_HEIGHT).png()
        const layers: sharp.OverlayOptions[] = []

        // Fetch and cache art, then composite it
        await CCGCardGenerator.cacheArt(card, appEmojis)
        const cached = artCache.get(card.id)
        if (cached) {
            const minLeft = ART_BOUND_LEFT + ART_PADDING
            const minTop = ART_BOUND_TOP + ART_PADDING
            const maxLeft = ART_BOUND_RIGHT - ART_PADDING - cached.width
            const maxTop = ART_BOUND_BOTTOM - ART_PADDING - cached.height
            const centeredLeft = ART_CENTER_X - Math.floor(cached.width / 2)
            const centeredTop = ART_CENTER_Y - Math.floor(cached.height / 2)
            const artLeft = Math.max(minLeft, Math.min(maxLeft, centeredLeft))
            const artTop = Math.max(minTop, Math.min(maxTop, centeredTop))
            layers.push({ input: cached.buffer, top: artTop, left: artLeft })
        }

        // Build SVG overlay with stats, name, description
        const overlaySvg = CCGCardGenerator.buildOverlaySVG(card, richSpans)
        layers.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 })

        // Composite everything onto the blank
        const baseBuffer = await base.toBuffer()
        const fullCard = await sharp(baseBuffer).composite(layers).png().toBuffer()
        const borderWidth = SERIES_CARD_BORDER[card.series]
        const finalCard = borderWidth ? await CCGCardGenerator.applyCardBorder(fullCard, borderWidth) : fullCard
        await fs.promises.writeFile(outputPath, finalCard)
    }

    private static async applyCardBorder(cardBuffer: Buffer, borderWidth: number): Promise<Buffer> {
        const innerW = CARD_WIDTH - 2 * borderWidth
        const innerH = CARD_HEIGHT - 2 * borderWidth

        // Shrink card content to inner dimensions and clip with rounded corners
        const resized = await sharp(cardBuffer).resize(innerW, innerH).png().toBuffer()
        const roundedInner = await sharp(resized)
            .composite([
                {
                    input: Buffer.from(
                        `<svg width="${innerW}" height="${innerH}"><rect width="${innerW}" height="${innerH}" rx="${BORDER_INNER_RADIUS}" ry="${BORDER_INNER_RADIUS}" fill="white"/></svg>`
                    ),
                    blend: 'dest-in',
                },
            ])
            .png()
            .toBuffer()

        // Black rounded base at full card size
        const blackBase = await sharp(
            Buffer.from(
                `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}"><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="${BORDER_OUTER_RADIUS}" ry="${BORDER_OUTER_RADIUS}" fill="black"/></svg>`
            )
        )
            .png()
            .toBuffer()

        return sharp(blackBase)
            .composite([{ input: roundedInner, top: borderWidth, left: borderWidth }])
            .png()
            .toBuffer()
    }

    /** Build a transparent SVG overlay with stats, card name, and effect description */
    private static buildOverlaySVG(card: CCGCard, richSpans: TextSpan[], originalCost?: number, originalSpeed?: number, originalAccuracy?: number): string {
        const escapedName = CCGCardGenerator.escapeXml(card.name)
        // Adaptive font sizing: try largest first, step down if any line is too wide
        const DESC_TIERS = [
            { fontSize: 28, maxChars: 27, lineHeight: 34 },
            { fontSize: 24, maxChars: 31, lineHeight: 29 },
            { fontSize: 20, maxChars: 38, lineHeight: 24 },
        ]
        let wrappedLines: TextSpan[][] = []
        let fontSize = 28
        let lineHeight = 34
        for (const tier of DESC_TIERS) {
            wrappedLines = CCGCardGenerator.wrapRichText(richSpans, tier.maxChars)
            fontSize = tier.fontSize
            lineHeight = tier.lineHeight
            // Accept this tier: no single line exceeds maxChars chars
            const maxLineLen = wrappedLines.reduce(
                (m, line) =>
                    Math.max(
                        m,
                        line.reduce((s, sp) => s + sp.text.length, 0)
                    ),
                0
            )
            if (maxLineLen <= tier.maxChars) break
        }
        const totalHeight = (wrappedLines.length - 1) * lineHeight
        const descStartY = DESC_START_Y - totalHeight / 2
        const identifierPillsSVG = (() => {
            if (!card.identifier?.length) return ''
            const PILL_H = 36
            const PILL_Y = 14
            // For 22px bold Arial, cap-height ≈ 15px. Baseline at PILL_Y+26 visually centers text in the pill.
            const PILL_TEXT_Y = PILL_Y + 26
            const SEPARATOR = ' · '
            // Estimate total text width: ~12.5px per char at 22px bold Arial, ~5.5px per separator char
            const textW =
                card.identifier.reduce((sum, id) => sum + id.replace(/_/g, ' ').length * 12.5, 0) + (card.identifier.length - 1) * SEPARATOR.length * 10
            const pillW = Math.ceil(textW + 24)
            const pillX = Math.round((CARD_WIDTH - pillW) / 2)
            const label = card.identifier.map((id) => CCGCardGenerator.escapeXml(id.replace(/_/g, ' '))).join(SEPARATOR)
            return (
                `\n  <!-- ═══ IDENTIFIERS ═══ -->` +
                `\n  <rect x="${pillX}" y="${PILL_Y}" width="${pillW}" height="${PILL_H}" rx="6" fill="#1a1a1a" fill-opacity="0.82" stroke="#555555" stroke-width="1"/>` +
                `\n  <text x="${Math.floor(
                    CARD_WIDTH / 2
                )}" y="${PILL_TEXT_Y}" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#cccccc" text-anchor="middle">${label}</text>`
            )
        })()

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <filter id="textShadow">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.8"/>
    </filter>
  </defs>

  <!-- ═══ STATS ═══ -->

  <!-- Speed (left) -->
    <text x="${SPEED_X}" y="${SPEED_Y}" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="${
            originalSpeed === undefined || card.speed === originalSpeed ? 'white' : card.speed > originalSpeed ? '#36a836' : '#bf4b4b'
        }" text-anchor="middle" dominant-baseline="central" filter="url(#textShadow)">${card.speed}</text>

  <!-- Cost (center) -->
    <text x="${COST_X}" y="${COST_Y}" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="${
            originalCost === undefined || card.cost === originalCost ? 'white' : card.cost < originalCost ? '#36a836' : '#bf4b4b'
        }" text-anchor="middle" dominant-baseline="central" filter="url(#textShadow)">${card.cost}</text>

  <!-- Accuracy (right) -->
    <text x="${ACCURACY_X}" y="${ACCURACY_Y}" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="${
            originalAccuracy === undefined || card.accuracy === originalAccuracy ? 'white' : card.accuracy > originalAccuracy ? '#36a836' : '#bf4b4b'
        }" text-anchor="middle" dominant-baseline="central" filter="url(#textShadow)">${card.accuracy}</text>

  <!-- ═══ CARD NAME ═══ -->
        <text x="${NAME_X}" y="${NAME_Y}" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central" filter="url(#textShadow)">${escapedName}</text>

    <!-- ═══ EFFECT DESCRIPTION ═══ -->
    <g font-family="Arial, sans-serif" font-size="${fontSize}">
    ${wrappedLines
        .map(
            (spans, i) =>
                `<text x="${DESC_X}" y="${descStartY + i * lineHeight}" text-anchor="middle" dominant-baseline="central" xml:space="preserve">${spans
                    .map((s) => `<tspan fill="${s.color}">${s.text}</tspan>`)
                    .join('')}</text>`
        )
        .join('\n    ')}
  </g>${identifierPillsSVG}</svg>`
    }

    // ═══ Rich text description system ═══

    /** Parse BBCode-style tagged string into TextSpans. E.g. "Deal [red]3 damage[/red]" */
    private static parseBBCode(input: string): TextSpan[] {
        const spans: TextSpan[] = []
        const regex = /\[([a-z]+)\](.*?)\[\/\1\]/gi
        let lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = regex.exec(input)) !== null) {
            if (match.index > lastIndex) {
                spans.push({ text: input.slice(lastIndex, match.index), color: WHITE })
            }
            const tag = match[1].toLowerCase()
            spans.push({ text: match[2], color: TAG_COLORS[tag] ?? WHITE })
            lastIndex = regex.lastIndex
        }
        if (lastIndex < input.length) {
            spans.push({ text: input.slice(lastIndex), color: WHITE })
        }
        return spans
    }

    /** Build rich colored description from card effects, including immunity line */
    private static buildRichDescription(card: CCGCard): TextSpan[] {
        const spans = CCGCardGenerator.buildBaseDescription(card)
        if (card.effectImmunities?.length) {
            const immStr = card.effectImmunities.map((i) => `[pink]${i.replace(/_/g, ' ')}[/pink]`).join(', ')
            return [...spans, ...CCGCardGenerator.parseBBCode(`. \nImmune to ${immStr}`)]
        }
        return spans
    }

    private static buildBaseDescription(card: CCGCard): TextSpan[] {
        // Check for custom description override
        if (card.customDescription) {
            return CCGCardGenerator.parseBBCode(card.customDescription)
        }

        if (!card.effects || card.effects.length === 0) return [{ text: 'No effect', color: WHITE }]

        // Strip effects that are implicit/mechanical and should not appear in description
        const effects = card.effects.filter((e) => !IMPLICIT_EFFECT_TYPES.has(e.type))
        if (effects.length === 0) return [{ text: 'No effect', color: WHITE }]

        // Check for conditional effect patterns (either/or)
        const conditionalPattern = CCGCardGenerator.detectConditionalPatterns(effects)
        if (conditionalPattern) {
            const description = CCGCardGenerator.buildConditionalDescription(
                conditionalPattern.baseEffect,
                conditionalPattern.bonusEffect,
                conditionalPattern.condition
            )
            return CCGCardGenerator.parseBBCode(description)
        }

        // Pattern: DAMAGE opponent + DAMAGE self → combined sentence
        if (
            effects.length === 2 &&
            effects[0].type === 'DAMAGE' &&
            effects[1].type === 'DAMAGE' &&
            effects[0].target === 'OPPONENT' &&
            effects[1].target === 'SELF'
        ) {
            let text = `Deal [red]${effects[0].value} damage[/red], but also receive [red]${effects[1].value} damage[/red]`
            if (effects[1].accuracy) text += ` (${effects[1].accuracy}%)`
            return CCGCardGenerator.parseBBCode(text)
        }

        // Pattern: DAMAGE self + GAIN_ENERGY → combined sentence
        if (effects.length === 2 && effects[0].type === 'DAMAGE' && effects[0].target === 'SELF' && effects[1].type === 'GAIN_ENERGY') {
            return CCGCardGenerator.parseBBCode(`Take [red]${effects[0].value} damage[/red], but gain [blue]${effects[1].value} extra energy[/blue]`)
        }

        // Pattern: REDUCE_COST for both self and opponent → "Reduce all card costs"
        if (
            effects.length === 2 &&
            effects[0].type === 'REDUCE_COST' &&
            effects[1].type === 'REDUCE_COST' &&
            effects[0].value === effects[1].value &&
            effects[0].turns === effects[1].turns
        ) {
            return CCGCardGenerator.parseBBCode(
                `Reduce [blue]all[/blue] card costs ${(effects[0].value ?? 0) >= 99 ? `to [blue]0[/blue]` : `by [blue]${effects[0].value}[/blue]`} for [pink]${
                    effects[0].turns
                } turns[/pink]`
            )
        }

        // Pattern: RECOVER + MYGLING → show recover amount, then the Mygling application sentence
        if (effects.length === 2) {
            const recover = effects.find((e) => e.type === 'RECOVER')
            const mygling = effects.find((e) => e.type === 'MYGLING')
            if (recover && mygling) {
                const healValue = recover.value ?? 0
                const healTurns = recover.turns ?? mygling.turns
                const myglingTurns = mygling.turns ?? recover.turns
                return CCGCardGenerator.parseBBCode(
                    `Heal [green]${healValue}[/green] per turn for [pink]${healTurns} turns[/pink]. Apply [pink]Mygling[/pink] for [pink]${myglingTurns} turns[/pink]`
                )
            }
        }

        // Default: describe each effect, join with ". "
        // Collapse consecutive identical-text effects into "... TWICE"
        const parts: string[] = []
        for (let i = 0; i < effects.length; i++) {
            const desc = CCGCardGenerator.describeEffect(effects[i])
            if (!desc) continue
            const condDesc = CCGCardGenerator.describeCondition(effects[i].condition)
            const fullDesc = condDesc ? `${desc} ${condDesc}` : desc
            if (i + 1 < effects.length && CCGCardGenerator.describeEffect(effects[i + 1]) === desc && !effects[i].condition && !effects[i + 1].condition) {
                parts.push(`${desc} [yellow]TWICE[/yellow]`)
                i++
            } else {
                parts.push(fullDesc)
            }
        }
        return CCGCardGenerator.parseBBCode(parts.join('. '))
    }

    /** Describe a condition in readable text */
    private static describeCondition(condition: any): string {
        if (!condition) return ''
        if (Array.isArray(condition)) {
            return condition
                .map((c) => CCGCardGenerator.describeCondition(c))
                .filter(Boolean)
                .join(' and ')
        }
        const tgtPlay = condition.target === 'SELF' ? 'you play' : condition.target === 'OPPONENT' ? 'opponent plays' : 'both players play'

        switch (condition.type) {
            case 'NUM_CARDS_PLAYED':
                if (condition.target === 'SELF' && condition.comparator === '==' && condition.value === 1) {
                    return condition.invert ? 'if not played alone' : 'if played alone'
                }
                return `if ${tgtPlay} ${condition.comparator} ${condition.value} card${condition.value !== 1 ? 's' : ''}`
            case 'PLAYED_CARD_IDENTIFIER': {
                const identifiers = Array.isArray(condition.identifier) ? condition.identifier.join(' or ') : condition.identifier
                if (condition.comparator === '>=' && condition.value >= 2) {
                    return `if played alongside another ${identifiers.replace(/_/g, ' ')}`
                }
                return `if ${tgtPlay} ${identifiers.replace(/_/g, ' ')} card`
            }
            case 'PLAYED_CARD_ID': {
                const cardName = [...mazariniCCG, ...swCCG, ...hpCCG].find((c) => c.id === condition.cardId)?.name ?? condition.cardId
                if (condition.comparator === '>=' && condition.value >= 2) {
                    return `if played alongside another ${cardName}`
                }
                if (condition.target === 'SELF' && condition.comparator === '>=' && condition.value === 1) {
                    return `if played with a ${cardName}`
                }
                return `if ${tgtPlay} ${cardName}`
            }
            case 'HP_BELOW':
                return `if ${condition.target.toLowerCase()} HP < ${condition.value}`
            case 'HP_ABOVE':
                return `if ${condition.target.toLowerCase()} HP > ${condition.value}`
            case 'ENERGY_BELOW':
                return `if ${condition.target.toLowerCase()} energy < ${condition.value}`
            case 'ENERGY_ABOVE':
                return `if ${condition.target.toLowerCase()} energy > ${condition.value}`
            case 'HAS_STATUS': {
                const statusName = (condition.status as string)?.replace(/_/g, ' ') ?? condition.status
                return `if ${condition.target.toLowerCase()} has ${statusName}`
            }
            case 'NOT_HAS_STATUS': {
                const statusName = (condition.status as string)?.replace(/_/g, ' ') ?? condition.status
                return `if ${condition.target.toLowerCase()} doesn't have ${statusName}`
            }
            case 'PLAYED_EFFECT_TYPE': {
                const effName = (condition.effectType as string)?.toLowerCase().replace(/_/g, ' ') ?? 'effect'
                return `if ${tgtPlay} a ${effName} effect`
            }
            case 'RANDOM':
                return `(${condition.chance}% chance)`
            default:
                return `if ${condition.type.toLowerCase()}`
        }
    }

    /** Detect either/or conditional effect patterns */
    private static detectConditionalPatterns(effects: CCGCardEffect[]): { baseEffect: CCGCardEffect; bonusEffect: CCGCardEffect; condition: any } | null {
        if (effects.length !== 2) return null

        const [effect1, effect2] = effects

        // Must be same effect type and target
        if (effect1.type !== effect2.type || effect1.target !== effect2.target) return null

        // Array conditions are not supported by the either/or pattern
        if (Array.isArray(effect1.condition) || Array.isArray(effect2.condition)) return null

        // After the array guard, conditions are CCGCondition (not CCGCondition[])
        const e1 = effect1 as CCGCardEffect & { condition?: CCGCondition }
        const e2 = effect2 as CCGCardEffect & { condition?: CCGCondition }

        // Pattern A: Both effects have explicit conditions — one without invert (bonus), one with invert:true (base/fallback)
        if (e1.condition && e2.condition) {
            const bonusEffect = [e1, e2].find((e) => e.condition && !e.condition.invert) ?? null
            const baseEffect = [e1, e2].find((e) => e.condition?.invert) ?? null

            if (!bonusEffect || !baseEffect) return null

            // Verify both conditions describe the same predicate (minus invert flag)
            const bonusCond = { ...bonusEffect.condition }
            const baseCond = { ...baseEffect.condition }
            delete baseCond.invert

            if (JSON.stringify(bonusCond) !== JSON.stringify(baseCond)) return null

            return { baseEffect, bonusEffect, condition: { ...bonusEffect.condition } }
        }

        // Pattern B: One effect has no condition (always applies = base), other has invert:true (fallback)
        const conditionalEffect = e1.condition ? e1 : e2.condition ? e2 : null
        const baseEffect = e1.condition ? e2 : e2.condition ? e1 : null

        if (!conditionalEffect || !baseEffect || !conditionalEffect.condition) return null

        if (!conditionalEffect.condition.invert) return null

        const baseCondition = baseEffect.condition
        if (baseCondition) {
            const invertedCondition = { ...conditionalEffect.condition }
            delete invertedCondition.invert

            if (JSON.stringify(baseCondition) !== JSON.stringify(invertedCondition)) return null
        }

        return {
            baseEffect,
            bonusEffect: conditionalEffect,
            condition: { ...conditionalEffect.condition },
        }
    }

    /** Build description for conditional effects in "base + bonus" format */
    private static buildConditionalDescription(baseEffect: CCGCardEffect, bonusEffect: CCGCardEffect, condition: any): string {
        const baseDesc = CCGCardGenerator.describeEffect(baseEffect)
        const bonusDesc = CCGCardGenerator.describeEffect(bonusEffect)
        const conditionDesc = CCGCardGenerator.describeCondition(condition)

        // Extract the numeric difference for cleaner display
        if (baseEffect.type === bonusEffect.type && typeof baseEffect.value === 'number' && typeof bonusEffect.value === 'number') {
            const diff = bonusEffect.value - baseEffect.value
            if (diff > 0) {
                // For same effect type, show as "+X bonus"
                const effectType = baseEffect.type.toLowerCase().replace('_', ' ')
                const colorTag = baseDesc.includes('[blue]') ? '[blue]' : baseDesc.includes('[red]') ? '[red]' : '[green]'
                return `${baseDesc}. ${colorTag}+${diff} ${effectType}[/${colorTag.split('[')[1]} ${conditionDesc}`
            }
        }

        // Fallback to full bonus description
        return `${baseDesc}. ${bonusDesc} ${conditionDesc}`
    }

    private static describeEffect(effect: CCGCardEffect): string {
        const tgt = effect.target === 'SELF' ? 'self' : 'opponent'
        const tgtPossessive = effect.target === 'SELF' ? 'your' : "opponent's"
        switch (effect.type) {
            case 'DAMAGE':
                return effect.target === 'SELF' ? `Take [red]${effect.value} damage[/red]` : `Deal [red]${effect.value} damage[/red]`
            case 'HEAL':
                if (effect.turns && effect.delayedTrigger) return `[green]Heal ${effect.value}[/green] in [pink]${effect.turns} turns[/pink]`
                return effect.turns ? `[green]Heal ${effect.value}[/green] for [pink]${effect.turns} turns[/pink]` : `[green]Heal ${effect.value}[/green]`
            case 'GAIN_ENERGY': {
                const energyVerb = effect.target === 'SELF' ? 'Gain' : 'Give opponent'
                if (effect.turns && effect.delayedTrigger) return `${energyVerb} [blue]${effect.value} energy[/blue] in [pink]${effect.turns} turns[/pink]`
                return effect.turns
                    ? `${energyVerb} [blue]${effect.value} energy[/blue] for [pink]${effect.turns} turns[/pink]`
                    : `${energyVerb} [blue]${effect.value} energy[/blue]`
            }
            case 'LOSE_ENERGY':
                return `Remove [blue]${effect.value} energy[/blue] from ${tgt}`
            case 'REMOVE_STATUS':
                return `Remove all [pink]status effects[/pink] from ${tgt}`
            case 'STEAL_CARD':
                return `Steal a card from ${tgt}`
            case 'BLEED':
                return `Apply [pink]Bleed[/pink] to ${tgt} for [pink]${effect.turns} turns[/pink]`
            case 'SHOCK':
                return `Apply [pink]Shock[/pink] to ${tgt} for [pink]${effect.turns} turns[/pink] ([red]${effect.value}[/red] dmg/turn)`
            case 'SHIELD':
                return `Shield for [blue]${effect.value}[/blue]`
            case 'REFLECT': {
                const reflectWhat =
                    effect.reflectType === 'allEffects'
                        ? 'first incoming [red]non-damage effect[/red]'
                        : effect.reflectType === 'all'
                        ? 'first incoming [red]effect[/red]'
                        : 'first incoming [red]damage[/red]'
                return effect.turns
                    ? `Reflect the ${reflectWhat} for [pink]${effect.turns} turn${effect.turns !== 1 ? 's' : ''}[/pink]`
                    : `Reflect the ${reflectWhat}`
            }
            case 'SLOW':
                return `Apply [pink]Slow[/pink] to ${tgt} for [pink]${effect.turns} turn${effect.turns !== 1 ? 's' : ''}[/pink]`
            case 'CHOKESTER':
                return `Apply [pink]Chokester[/pink] to ${tgt} for [pink]${effect.turns} turns[/pink]`
            case 'MYGLING':
                return `Apply [pink]Mygling[/pink] to ${tgt} for [pink]${effect.turns} turns[/pink]`
            case 'EIVINDPRIDE':
                return `Apply [pink]Eivindpride[/pink] to ${tgt} for [pink]${effect.turns} turns[/pink] (${effect.statusAccuracy}%)`
            case 'VIEW_HAND':
                return `View ${tgt}'s hand`
            case 'RETARDED': {
                const retBase = `Apply [pink]Retarded[/pink] to ${tgt} for [pink]${effect.turns} turn${effect.turns !== 1 ? 's' : ''}[/pink]`
                return effect.statusAccuracy !== undefined && effect.statusAccuracy < 100 ? `${retBase} (${effect.statusAccuracy}%)` : retBase
            }
            case 'WAITING':
                return `Randomly [yellow]waits[/yellow] between [pink]1 and ${effect.turns} turns[/pink] before doing damage equal to triple the turns waited`
            case 'CHOKE_SHIELD':
                return `Apply [pink]Choke Shield[/pink] to ${tgt} for [pink]${effect.turns} turns[/pink]`
            case 'REDUCE_COST': {
                const costAmt = (effect.value ?? 0) >= 99 ? `to [blue]0[/blue]` : `by [blue]${effect.value}[/blue]`
                return `Reduce ${tgtPossessive} ${effect.identifier ? `[yellow]${effect.identifier}[/yellow] ` : ''}card costs ${costAmt} for [pink]${
                    effect.turns
                } turns[/pink]`
            }
            case 'SPEED_BUFF':
                return `Increase [pink]${tgtPossessive}[/pink] speed ([green]+50%[/green]) for [pink]${effect.turns} turns[/pink]`
            case 'RECOVER':
                return `Heal [green]${effect.value}[/green] each turn for [pink]${effect.turns} turns[/pink]`
            case 'DAMAGE_BOOST':
                return `Boost ${tgtPossessive} direct damage by [red]+${effect.value}[/red] for [pink]${effect.turns} turns[/pink]`
            case 'EXTRA_CARDS':
                return `Play [blue]${effect.value} cards[/blue] for [pink]${effect.turns} turns[/pink]`
            case 'TRANSFORM':
                if (effect.transformCardId) {
                    const name = [...mazariniCCG, ...swCCG, ...hpCCG].find((c) => c.id === effect.transformCardId)?.name ?? effect.transformCardId
                    return `Transform into [yellow]${name}[/yellow] with ${effect.accuracy ?? 100}% chance`
                }
                if (effect.transformSeries) return `Transform into a random [yellow]${effect.transformSeries.replace('CCG', '')} card[/yellow] and resolve it`
                return `Transform (unknown card)`
            case 'SHOOT':
                return `Fire [yellow]${effect.amount ?? 1}[/yellow] shots at ${tgt} ([yellow]${effect.accuracy ?? 100}%[/yellow] hit, [red]${
                    effect.value ?? 1
                }[/red] each)`
            case 'DAMAGE_PER_IDENTIFIER':
                return `Deal [red]${effect.base ?? 0} damage[/red] to ${tgt} (+[red]${effect.value ?? 1} damage[/red] per [yellow]${
                    effect.identifier ?? ''
                }[/yellow] played this round)`
            case 'DAMAGE_PER_CARD_PLAYED': {
                const who = effect.countTarget === 'BOTH' ? 'both players' : effect.countTarget === 'OPPONENT' ? 'opponent' : 'you'
                return `Deal [red]${effect.value ?? 1} damage[/red] per card ${who} play${who === 'opponent' ? 's' : ''} this round`
            }
            case 'NEUTRALIZE_ATTACK':
                return `Neutralize an incoming [red]attack[/red]`
            case 'BOUNTY':
                return `Apply [pink]BOUNTY[/pink] to ${tgt}`
            case 'CLAIM_BOUNTY':
                return ''
            case 'STEAL_ENERGY':
                return `Steal [blue]${effect.value ?? 1} energy[/blue] from ${tgt}`
            case 'DISCARD_CARD':
                return `Discard [yellow]${effect.amount ?? 1}[/yellow] card(s) from ${tgtPossessive} hand`
            case 'ELUSIVE':
                return `Apply [pink]ELUSIVE[/pink] to ${tgt} for [pink]${effect.turns} turns[/pink]`
            case 'ARMOR':
                return `Gain [green]${effect.value} Armor[/green] for [pink]${effect.turns} turns[/pink]`
            case 'PERSISTENT_APPEARANCE':
                return `Pester ${tgt} for [pink]${effect.turns} turns[/pink] ([yellow]${effect.statusAccuracy ?? 100}%[/yellow] chance, [red]${
                    effect.value ?? 1
                }[/red] dmg/turn)`
            case 'SUMMON_CARD':
                return effect.summonCardId
                    ? `Summon [yellow]${
                          [...mazariniCCG, ...swCCG, ...hpCCG].find((c) => c.id === effect.summonCardId)?.name ?? effect.summonCardId
                      }[/yellow] to hand`
                    : `Summon a random [yellow]${effect.identifier?.replace(/_/g, ' ') ?? ''}[/yellow] card to hand`
            default:
                return `${effect.type}`
        }
    }

    /** Wrap rich text spans into lines, preserving per-word colors */
    private static wrapRichText(spans: TextSpan[], maxChars: number): TextSpan[][] {
        // Split spans into word-level tokens
        const tokens: TextSpan[] = []
        for (const span of spans) {
            const parts = span.text.split(/( +)/)
            for (const part of parts) {
                if (part) tokens.push({ text: part, color: span.color })
            }
        }

        const lines: TextSpan[][] = []
        let currentLine: TextSpan[] = []
        let currentLength = 0

        for (const token of tokens) {
            const len = token.text.length
            if (currentLength + len > maxChars && currentLine.length > 0 && token.text.trim()) {
                lines.push(CCGCardGenerator.mergeAdjacentSpans(currentLine))
                currentLine = []
                currentLength = 0
                if (!token.text.trim()) continue
            }
            currentLine.push(token)
            currentLength += len
        }
        if (currentLine.length > 0) {
            lines.push(CCGCardGenerator.mergeAdjacentSpans(currentLine))
        }

        return lines.slice(0, 6)
    }

    /** Merge adjacent spans with the same color */
    private static mergeAdjacentSpans(spans: TextSpan[]): TextSpan[] {
        const merged: TextSpan[] = []
        for (const span of spans) {
            if (merged.length > 0 && merged[merged.length - 1].color === span.color) {
                merged[merged.length - 1].text += span.text
            } else {
                merged.push({ text: span.text, color: span.color })
            }
        }
        // Escape XML in final spans
        return merged.map((s) => ({ text: CCGCardGenerator.escapeXml(s.text), color: s.color }))
    }

    private static escapeXml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    }

    // ─── Programmatic blank generation ───────────────────────────────────────

    /** Accent colours used per rarity when generating blanks programmatically */
    private static readonly RARITY_ACCENT: Record<string, string> = {
        [ItemRarity.Common]: '#7f9bb5',
        [ItemRarity.Rare]: '#1a92ce',
        [ItemRarity.Epic]: '#9b59b6',
        [ItemRarity.Legendary]: '#c8a000',
    }

    /**
     * Generate a single blank template (480×672 PNG) from a background image.
     *
     * The background is stretched to fill the full card. The Dextrous-derived
     * frame (portrait border, separator, stat badges, cost ring, accuracy
     * bullseye, card border) is drawn on top as an SVG layer. All coordinates
     * are derived from the Dextrous HTML (240×336 base) scaled ×2.
     *
     * @param backgroundBuffer  Raw image buffer for the card background
     * @param rarity            ItemRarity – controls the accent colour
     */
    /**
     * Generate a single blank template (480×672 PNG) from one background image.
     *
     * The background is stretched to fill the full card. The frame SVG is
     * transparent over the portrait area so the background always shows through —
     * only the glow, badges, ring, separator and border are drawn. This means
     * any series background (HP castle, SW starfield, etc.) works with the same
     * frame; only the accent colour changes per rarity.
     *
     * @param bgBuffer        Full-card background image (scaled to fill 480×672)
     * @param rarity          Controls the accent colour
     * @param accentOverride  Optional hex colour to override the rarity default
     */
    static async generateBlankBuffer(bgBuffer: Buffer, rarity: ItemRarity, accentOverride?: string): Promise<Buffer> {
        const W = CARD_WIDTH // 480
        const H = CARD_HEIGHT // 672
        const accent = accentOverride ?? CCGCardGenerator.RARITY_ACCENT[rarity] ?? '#1a92ce'

        // 1. Scale background to full card and round corners
        const bg = await sharp(bgBuffer).resize(W, H, { fit: 'fill' }).png().toBuffer()

        const roundedBg = await sharp(bg)
            .composite([
                {
                    input: Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="20" ry="20" fill="white"/></svg>`),
                    blend: 'dest-in',
                },
            ])
            .png()
            .toBuffer()

        // 2. Composite the frame (transparent portrait area + all chrome elements)
        const frameSvg = CCGCardGenerator.buildBlankFrameSVG(W, H, accent)
        return sharp(roundedBg)
            .composite([{ input: Buffer.from(frameSvg), top: 0, left: 0 }])
            .png()
            .toBuffer()
    }

    /**
     * Generate and save all four rarity blanks for a series.
     *
     * @param seriesDir     Absolute path to the series blank directory (e.g. res/ccg/blanks/newSeries)
     * @param bgBuffer      Background image buffer shared across all rarities
     * @param prefix        Filename prefix, e.g. 'newSeries' → 'newSeries_common_blank.png'
     */
    static async generateAndSaveBlanks(seriesDir: string, bgBuffer: Buffer, prefix: string): Promise<void> {
        if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true })
        for (const rarity of [ItemRarity.Common, ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary]) {
            const buf = await CCGCardGenerator.generateBlankBuffer(bgBuffer, rarity)
            const filename = `${prefix}_${rarity}_blank.png`
            fs.writeFileSync(path.resolve(seriesDir, filename), buf)
            console.log(`[CCG] Generated blank: ${filename}`)
        }
    }

    /**
     * Build the SVG frame overlay that is composited onto the background to
     * produce a card blank. Coordinates are pixel-matched to the Dextrous
     * card design (240×336 base × 2 = 480×672).
     */
    private static buildBlankFrameSVG(W: number, H: number, accent: string): string {
        // Pentagon clip-path (badge shape: rectangle with pointed bottom centre)
        const pentagon = 'polygon(0% 0%, 100% 0%, 100% 95%, 50% 100%, 0% 95%)'

        // ── Portrait frame ──────────────────────────────────
        // image zone: left 55.5×2=111, top 39×2=78, 128×2=256 sq.
        const pX = 111,
            pY = 78,
            pW = 256,
            pH = 256,
            pR = 10

        // ── Stat strip ──────────────────────────────────────
        // separator: top 190×2=380, left 3×2=6, width 233×2=466
        const sepY = 380,
            sepX = 6,
            sepW = 466

        // ── Left stat badge (speed) ──────────────────────────
        // zone-77: left 9×2=18, top 204×2=408, w 30.7×2=61.4, h 29×2=58
        const lbX = 18,
            lbY = 408,
            lbW = 61,
            lbH = 58

        // ── Right stat badge (accuracy container) ────────────
        // zone-43: left 199.4×2=399, top 204×2=408, same size
        const rbX = 399,
            rbY = 408,
            rbW = 61,
            rbH = 58

        // ── Speed arrows (two right-pointing chevrons) ────────
        // Speed chevrons — centered inside the left badge (cx≈49, cy≈437)
        // Two >> chevrons as stroked paths, not filled triangles
        const sCx = lbX + Math.round(lbW / 2) // badge center x ≈ 49
        const sCy = lbY + Math.round(lbH / 2) // badge center y ≈ 437
        const sH = 26 // half-height of each chevron arm
        const sW = 11 // horizontal reach of each chevron
        // Chevron 1 left edge x, chevron 2 left edge x (4px gap between them)
        const s1X = sCx - sW - 2,
            s2X = sCx + 2

        // ── Cost ring ────────────────────────────────────────
        // outer: left 100×2=200, top 183.5×2=367, size 40×2=80 → cx=240, cy=407, r=40
        // inner: offset 2.5×2=5 → cx=240, cy=407, r=35
        const cX = 240,
            cY = 407,
            cOuter = 40,
            cInner = 35,
            cRing = 32

        // ── Accuracy bullseye ────────────────────────────────
        // zone-26: left 203.6×2=407, top 209.2×2=418, w 19.7×2=39, h 19.3×2=39
        // cx = 407+19.5=426.5≈427, cy = 418+19.5=437.5≈438
        const bX = 427,
            bY = 438
        const bR = [19.5, 16, 12.9, 9.8, 6.5, 3.3]
        const bColors = ['#990910', '#d7d7d7', '#990910', '#d7d7d7', '#990910', '#d7d7d7']

        const lineY = 404 // separator line y (zone-67: top 190×2=380, clip 60% of 40px = +24)

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>

    <!-- Portrait glow filter: blurs the accent stroke outward -->
    <filter id="portraitGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="12"/>
    </filter>

    <!-- Upper accent overlay: tints background from bottom (accent) to top (dark wash) -->
    <linearGradient id="upperOverlay" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="0.5"/>
      <stop offset="50%"  stop-color="black"     stop-opacity="0.2"/>
      <stop offset="100%" stop-color="black"     stop-opacity="0.05"/>
    </linearGradient>

    <!-- Lower dark overlay: keeps description area readable over any background -->
    <linearGradient id="lowerOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="black" stop-opacity="0"/>
      <stop offset="25%"  stop-color="black" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.85"/>
    </linearGradient>

    <!-- Separator: black → accent → black -->
    <linearGradient id="sepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="black"/>
      <stop offset="50%"  stop-color="${accent}"/>
      <stop offset="100%" stop-color="black"/>
    </linearGradient>

    <!-- Stat badge: accent top → black bottom -->
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="${accent}"/>
      <stop offset="100%" stop-color="black"/>
    </linearGradient>
    <radialGradient id="badgeShell">
      <stop offset="0%"   stop-color="white"/>
      <stop offset="100%" stop-color="black"/>
    </radialGradient>

    <!-- Cost ring outer: dark → accent (54%) → dark -->
    <linearGradient id="costGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="rgba(0,0,0,0.69)"/>
      <stop offset="54%"  stop-color="${accent}"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.69)"/>
    </linearGradient>
    <!-- Cost inner fill -->
    <linearGradient id="costFill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="rgba(61,61,61,0.69)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.5)"/>
    </linearGradient>

  </defs>

  <!-- ═══ 1. UPPER ACCENT TINT ═══ -->
  <!-- Rarity colour bleeds up from the bottom of the portrait area over the background -->
  <rect x="0" y="0" width="${W}" height="${pY + pH + 60}" fill="url(#upperOverlay)"/>

  <!-- ═══ 2. PORTRAIT GLOW (transparent interior — background shows through) ═══ -->
  <!-- Blurred outer glow ring — drawn BEFORE the frame so it bleeds outward -->
  <rect x="${pX - 8}" y="${pY - 8}" width="${pW + 16}" height="${pH + 16}"
        rx="${pR + 4}" ry="${pR + 4}"
        fill="none" stroke="${accent}" stroke-width="22" opacity="0.45"
        filter="url(#portraitGlow)"/>
  <!-- Crisp accent border on top -->
  <rect x="${pX}" y="${pY}" width="${pW}" height="${pH}"
        rx="${pR}" ry="${pR}"
        fill="none" stroke="${accent}" stroke-width="2" opacity="0.8"/>

  <!-- ═══ 3. LOWER DARK OVERLAY (behind name + description text) ═══ -->
  <!-- Fades the background to dark so text is always readable -->
  <rect x="0" y="${lineY - 20}" width="${W}" height="${H - lineY + 20}" fill="url(#lowerOverlay)"/>

  <!-- ═══ 4. SEPARATOR LINE + GLOW (zone-67 / zone-78) ═══ -->
  <rect x="${sepX}" y="${lineY}" width="${sepW}" height="4" fill="url(#sepGrad)" opacity="0.9"/>
  <ellipse cx="${W / 2}" cy="${lineY + 18}" rx="220" ry="16" fill="${accent}" opacity="0.15"/>

  <!-- ═══ 5. DECORATIVE DIVIDER (zone-66 description_line) ═══ -->
  <!-- Left rule -->
  <line x1="${sepX + 6}" y1="${lineY + 22}" x2="${W / 2 - 26}" y2="${lineY + 22}"
        stroke="${accent}" stroke-width="1" opacity="0.5"/>
  <!-- Right rule -->
  <line x1="${W / 2 + 26}" y1="${lineY + 22}" x2="${sepX + sepW - 6}" y2="${lineY + 22}"
        stroke="${accent}" stroke-width="1" opacity="0.5"/>
  <!-- Centre diamond -->
  <polygon points="${W / 2},${lineY + 14} ${W / 2 + 9},${lineY + 22} ${W / 2},${lineY + 30} ${W / 2 - 9},${lineY + 22}"
           fill="${accent}" opacity="0.8"/>
  <!-- Flanking small diamonds -->
  <polygon points="${W / 2 - 20},${lineY + 19} ${W / 2 - 15},${lineY + 22} ${W / 2 - 20},${lineY + 25} ${W / 2 - 25},${lineY + 22}"
           fill="${accent}" opacity="0.5"/>
  <polygon points="${W / 2 + 20},${lineY + 19} ${W / 2 + 25},${lineY + 22} ${W / 2 + 20},${lineY + 25} ${W / 2 + 15},${lineY + 22}"
           fill="${accent}" opacity="0.5"/>

  <!-- ═══ 6. LEFT STAT BADGE (speed) ═══ -->
  <polygon points="${lbX},${lbY} ${lbX + lbW},${lbY} ${lbX + lbW},${lbY + lbH * 0.95} ${lbX + lbW / 2},${lbY + lbH} ${lbX},${lbY + lbH * 0.95}"
           fill="url(#badgeShell)" opacity="0.15"/>
  <polygon points="${lbX + 2},${lbY + 1} ${lbX + lbW - 2},${lbY + 1} ${lbX + lbW - 2},${lbY + lbH * 0.94} ${lbX + lbW / 2},${lbY + lbH - 1} ${lbX + 2},${
            lbY + lbH * 0.94
        }"
           fill="url(#badgeGrad)" opacity="0.9"/>

  <!-- ═══ 7. SPEED CHEVRONS (>>) — centered in left badge ═══ -->
  <!-- Chevron 1 -->
  <path d="M ${s1X} ${sCy - sH} L ${s1X + sW} ${sCy} L ${s1X} ${sCy + sH}"
        fill="none" stroke="white" stroke-width="4.5"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
  <!-- Chevron 2 -->
  <path d="M ${s2X} ${sCy - sH} L ${s2X + sW} ${sCy} L ${s2X} ${sCy + sH}"
        fill="none" stroke="white" stroke-width="4.5"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
  <!-- Subtle accent colour echo behind for depth -->
  <path d="M ${s1X} ${sCy - sH} L ${s1X + sW} ${sCy} L ${s1X} ${sCy + sH}"
        fill="none" stroke="${accent}" stroke-width="7"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
  <path d="M ${s2X} ${sCy - sH} L ${s2X + sW} ${sCy} L ${s2X} ${sCy + sH}"
        fill="none" stroke="${accent}" stroke-width="7"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>

  <!-- ═══ 8. RIGHT STAT BADGE (accuracy) ═══ -->
  <polygon points="${rbX},${rbY} ${rbX + rbW},${rbY} ${rbX + rbW},${rbY + rbH * 0.95} ${rbX + rbW / 2},${rbY + rbH} ${rbX},${rbY + rbH * 0.95}"
           fill="url(#badgeShell)" opacity="0.15"/>
  <polygon points="${rbX + 2},${rbY + 1} ${rbX + rbW - 2},${rbY + 1} ${rbX + rbW - 2},${rbY + rbH * 0.94} ${rbX + rbW / 2},${rbY + rbH - 1} ${rbX + 2},${
            rbY + rbH * 0.94
        }"
           fill="url(#badgeGrad)" opacity="0.9"/>

  <!-- ═══ 9. ACCURACY BULLSEYE ═══ -->
  ${bR.map((r, i) => `<circle cx="${bX}" cy="${bY}" r="${r}" fill="${bColors[i]}"/>`).join('\n  ')}

  <!-- ═══ 10. COST RING ═══ -->
  <circle cx="${cX}" cy="${cY}" r="${cOuter}" fill="url(#costGrad)"/>
  <circle cx="${cX}" cy="${cY}" r="${cInner}" fill="${accent}" opacity="0.85"/>
  <circle cx="${cX}" cy="${cY}" r="${cRing}"  fill="url(#costFill)"/>

  <!-- ═══ 11. CARD BORDER ═══ -->
  <rect x="7" y="7" width="${W - 14}" height="${H - 14}" rx="20" ry="20"
        fill="none" stroke="${accent}" stroke-width="7" opacity="0.65"/>
  <rect x="11" y="11" width="${W - 22}" height="${H - 22}" rx="17" ry="17"
        fill="none" stroke="white" stroke-width="1" opacity="0.08"/>

</svg>`
    }
}

interface TextSpan {
    text: string
    color: string
}
