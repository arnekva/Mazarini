import * as crypto from 'crypto'
import { ApplicationEmoji, Collection } from 'discord.js'
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { MazariniClient } from '../client/MazariniClient'
import { mazariniCCG } from '../commands/ccg/cards/mazariniCCG'
import { swCCG } from '../commands/ccg/cards/swCCG'
import { CCGCard, CCGCardEffect } from '../commands/ccg/ccgInterface'
import { ItemRarity } from '../interfaces/database/databaseInterface'

const CARD_WIDTH = 480
const CARD_HEIGHT = 672
const OUTPUT_DIR = path.resolve('res/ccg/generated')
const HASH_FILE = path.resolve('res/ccg/generated/.hashes.json')
const BLANKS_DIR = path.resolve('res/ccg/blanks')

/** Series whose application emoji names match the card ID exactly (no series prefix) */
const SERIES_EMOJI_IS_ID = new Set(['swCCG'])

/** Map rarity to its blank background filename */
const RARITY_BLANK: Record<string, string> = {
    [ItemRarity.Common]: 'mazarini_common_blank.png',
    [ItemRarity.Rare]: 'mazarini_rare_blank.png',
    [ItemRarity.Epic]: 'mazarini_epic_blank.png',
    [ItemRarity.Legendary]: 'mazarini_legendary_blank.png',
}

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

// Layout constants for 480x672 card (pixel-matched to blank templates)
const ART_SIZE = 255
const ART_X = 112
const ART_Y = 78
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
}

export class CCGCardGenerator {
    /** Returns true if card generation is complete and CCG games can be started */
    static get isReady(): boolean {
        return _isReady
    }

    /** Generate all card images. Only regenerates cards whose data has changed. */
    static async generateAll(client: MazariniClient): Promise<void> {
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

        const genStart = Date.now()
        for (const card of [...mazariniCCG, ...swCCG]) {
            const hash = CCGCardGenerator.hashCard(card)
            const outputPath = CCGCardGenerator.getCardPath(card)

            if (existingHashes[card.id] === hash && fs.existsSync(outputPath)) {
                // Still populate the art cache even for unchanged cards
                await CCGCardGenerator.cacheArt(card, appEmojis)
                skipped++
                continue
            }

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
    }

    /** Get the local file path for a generated card image */
    static getCardPath(card: CCGCard): string {
        const seriesDir = path.resolve(OUTPUT_DIR, card.series)
        if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true })
        return path.resolve(seriesDir, `${card.id}_small.png`)
    }

    /** Read a generated card image as a Buffer */
    static async getCardBuffer(card: CCGCard): Promise<Buffer> {
        const cardPath = CCGCardGenerator.getCardPath(card)
        return await fs.promises.readFile(cardPath)
    }

    /**
     * Generate a modified card image to an in-memory Buffer without saving to disk.
     * Uses cached art from the last generateAll run. Falls back to the unmodified card file
     * if no art is cached (e.g. bot just restarted and generation hasn't run yet).
     */
    static async getModifiedCardBuffer(card: CCGCard, mods: CardModification[]): Promise<Buffer> {
        const modified = CCGCardGenerator.applyModifications(card, mods)
        const richSpans = CCGCardGenerator.buildRichDescription(modified)

        const blankFile = card.blank ? `${card.blank}.png` : RARITY_BLANK[card.rarity] ?? RARITY_BLANK[ItemRarity.Common]
        const blankPath = path.resolve(BLANKS_DIR, blankFile)
        const base = sharp(blankPath).resize(CARD_WIDTH, CARD_HEIGHT).png()
        const layers: sharp.OverlayOptions[] = []

        const cached = artCache.get(card.id)
        if (cached) {
            const artLeft = ART_X + Math.floor((ART_SIZE - cached.width) / 2)
            const artTop = ART_Y + Math.floor((ART_SIZE - cached.height) / 2)
            layers.push({ input: cached.buffer, top: artTop, left: artLeft })
        }

        const overlaySvg = CCGCardGenerator.buildOverlaySVG(modified, richSpans)
        layers.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 })

        const baseBuffer = await base.toBuffer()
        return await sharp(baseBuffer).composite(layers).png().toBuffer()
    }

    /** Apply a list of modifications to a deep copy of a card */
    private static applyModifications(card: CCGCard, mods: CardModification[]): CCGCard {
        const c = structuredClone(card)
        // Apply overrides first, then deltas
        for (const mod of mods) {
            if (mod.type === 'ACCURACY_OVERRIDE') c.accuracy = mod.value
        }
        for (const mod of mods) {
            switch (mod.type) {
                case 'COST_DELTA':
                    c.cost = Math.max(0, c.cost + mod.value)
                    break
                case 'DAMAGE_DELTA':
                    for (const effect of c.effects) {
                        if (effect.type === 'DAMAGE' && effect.value !== undefined) {
                            effect.value = Math.max(0, effect.value + mod.value)
                        }
                    }
                    break
                case 'HEAL_DELTA':
                    for (const effect of c.effects) {
                        if (effect.type === 'HEAL' && effect.value !== undefined) {
                            effect.value = Math.max(0, effect.value + mod.value)
                        }
                    }
                    break
                case 'ENERGY_DELTA':
                    for (const effect of c.effects) {
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
            blank: card.blank,
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

    /** Fetch, resize and round-clip art for a card, storing it in the art cache */
    private static async cacheArt(card: CCGCard, appEmojis: Collection<string, ApplicationEmoji>): Promise<void> {
        if (artCache.has(card.id)) return
        const artBuffer = await CCGCardGenerator.fetchEmojiArt(card, appEmojis)
        if (!artBuffer) return
        const resizedArt = await sharp(artBuffer).resize(ART_SIZE, ART_SIZE, { fit: 'inside' }).png().toBuffer()
        const meta = await sharp(resizedArt).metadata()
        const actualW = meta.width ?? ART_SIZE
        const actualH = meta.height ?? ART_SIZE
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

        // Load the blank background (card-level override or rarity default)
        const blankFile = card.blank ? `${card.blank}.png` : RARITY_BLANK[card.rarity] ?? RARITY_BLANK[ItemRarity.Common]
        const blankPath = path.resolve(BLANKS_DIR, blankFile)
        const base = sharp(blankPath).resize(CARD_WIDTH, CARD_HEIGHT).png()
        const layers: sharp.OverlayOptions[] = []

        // Fetch and cache art, then composite it
        await CCGCardGenerator.cacheArt(card, appEmojis)
        const cached = artCache.get(card.id)
        if (cached) {
            const artLeft = ART_X + Math.floor((ART_SIZE - cached.width) / 2)
            const artTop = ART_Y + Math.floor((ART_SIZE - cached.height) / 2)
            layers.push({ input: cached.buffer, top: artTop, left: artLeft })
        }

        // Build SVG overlay with stats, name, description
        const overlaySvg = CCGCardGenerator.buildOverlaySVG(card, richSpans)
        layers.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 })

        // Composite everything onto the blank
        const baseBuffer = await base.toBuffer()
        await sharp(baseBuffer).composite(layers).png().toFile(outputPath)
    }

    /** Build a transparent SVG overlay with stats, card name, and effect description */
    private static buildOverlaySVG(card: CCGCard, richSpans: TextSpan[]): string {
        const escapedName = CCGCardGenerator.escapeXml(card.name)
        const wrappedLines = CCGCardGenerator.wrapRichText(richSpans, 32)
        const lineHeight = 34
        const totalHeight = (wrappedLines.length - 1) * lineHeight
        const descStartY = DESC_START_Y - totalHeight / 2

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <filter id="textShadow">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.8"/>
    </filter>
  </defs>

  <!-- ═══ STATS ═══ -->

  <!-- Speed (left) -->
  <text x="${SPEED_X}" y="${SPEED_Y}" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central" filter="url(#textShadow)">${
            card.speed
        }</text>

  <!-- Cost (center) -->
  <text x="${COST_X}" y="${COST_Y}" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central" filter="url(#textShadow)">${
            card.cost
        }</text>

  <!-- Accuracy (right) -->
  <text x="${ACCURACY_X}" y="${ACCURACY_Y}" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central" filter="url(#textShadow)">${
            card.accuracy
        }</text>

  <!-- ═══ CARD NAME ═══ -->
  <text x="${NAME_X}" y="${NAME_Y}" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central" filter="url(#textShadow)">${escapedName}</text>

  <!-- ═══ EFFECT DESCRIPTION ═══ -->
  <g font-family="Arial, sans-serif" font-size="26">
    ${wrappedLines
        .map(
            (spans, i) =>
                `<text x="${DESC_X}" y="${descStartY + i * lineHeight}" text-anchor="middle" dominant-baseline="central" xml:space="preserve">${spans
                    .map((s) => `<tspan fill="${s.color}">${s.text}</tspan>`)
                    .join('')}</text>`
        )
        .join('\n    ')}
  </g>
</svg>`
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

    /** Build rich colored description from card effects */
    private static buildRichDescription(card: CCGCard): TextSpan[] {
        if (!card.effects || card.effects.length === 0) return [{ text: 'No effect', color: WHITE }]

        const effects = card.effects

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
                `Reduce [blue]all[/blue] card costs by [blue]${effects[0].value}[/blue] for [pink]${effects[0].turns} turns[/pink]`
            )
        }

        // Default: describe each effect, join with ". "
        // Collapse consecutive identical-text effects into "... TWICE"
        const parts: string[] = []
        for (let i = 0; i < effects.length; i++) {
            const desc = CCGCardGenerator.describeEffect(effects[i])
            if (i + 1 < effects.length && CCGCardGenerator.describeEffect(effects[i + 1]) === desc) {
                parts.push(`${desc} [yellow]TWICE[/yellow]`)
                i++
            } else {
                parts.push(desc)
            }
        }
        return CCGCardGenerator.parseBBCode(parts.join('. '))
    }

    private static describeEffect(effect: CCGCardEffect): string {
        switch (effect.type) {
            case 'DAMAGE':
                return effect.target === 'SELF' ? `Take [red]${effect.value} damage[/red]` : `Deal [red]${effect.value} damage[/red]`
            case 'HEAL':
                return `Heal [green]${effect.value}[/green]`
            case 'GAIN_ENERGY':
                return effect.turns
                    ? `Gain [blue]${effect.value} energy[/blue] for [pink]${effect.turns} turns[/pink]`
                    : `Gain [blue]${effect.value} energy[/blue]`
            case 'LOSE_ENERGY':
                return `Remove [blue]${effect.value} energy[/blue] from opponent`
            case 'REMOVE_STATUS':
                return `Remove all [pink]status effects[/pink]`
            case 'STEAL_CARD':
                return `Steal a card from opponent`
            case 'BLEED':
                return `Apply [pink]Bleed[/pink] to opponent for [pink]${effect.turns} turns[/pink]`
            case 'SHIELD':
                return `Shield for [blue]${effect.value}[/blue]`
            case 'REFLECT':
                return effect.turns ? `Reflect damage for [pink]${effect.turns} turn[/pink]` : `Reflect damage`
            case 'SLOW':
                return `Apply [pink]Slow[/pink] to opponent for [pink]${effect.turns} turns[/pink]`
            case 'CHOKESTER':
                return `Apply [pink]Chokester[/pink] for [pink]${effect.turns} turns[/pink]`
            case 'MYGLING':
                return `Heal [green]${effect.value}[/green] each turn for [pink]${effect.turns} turns[/pink]`
            case 'EIVINDPRIDE':
                return `Apply [pink]Eivindpride[/pink] for [pink]${effect.turns} turns[/pink] (${effect.statusAccuracy}%)`
            case 'VIEW_HAND':
                return `View opponent's hand`
            case 'RETARDED':
                return `Apply [pink]Retarded[/pink] to ${effect.target === 'SELF' ? 'self' : 'opponent'} for [pink]${effect.turns} turns[/pink] (${
                    effect.statusAccuracy
                }%)`
            case 'WAITING':
                return `Randomly [yellow]waits[/yellow] between [pink]1 and ${effect.turns} turns[/pink] before doing damage equal to triple the turns waited`
            case 'CHOKE_SHIELD':
                return `Apply [pink]Choke Shield[/pink] for [pink]${effect.turns} turns[/pink]`
            case 'REDUCE_COST':
                return `Reduce card costs by [blue]${effect.value}[/blue] for [pink]${effect.turns} turns[/pink]`
            case 'SPEED_BUFF':
                return `Speed ([green]+50%[/green]) for [pink]${effect.turns} turns[/pink]`
            case 'RECOVER':
                return `Heal [green]${effect.value}[/green] each turn for [pink]${effect.turns} turns[/pink]`
            case 'DAMAGE_BOOST':
                return `Boost all damage by [red]+${effect.value}[/red] for [pink]${effect.turns} turns[/pink]`
            case 'EXTRA_CARDS':
                return `Play [blue]${effect.value} cards[/blue] next turn`
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
}

interface TextSpan {
    text: string
    color: string
}
