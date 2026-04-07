import * as crypto from 'crypto'
import { ApplicationEmoji, Collection } from 'discord.js'
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { MazariniClient } from '../client/MazariniClient'
import { mazariniCCG } from '../commands/ccg/cards/mazariniCCG'
import { swCCG } from '../commands/ccg/cards/swCCG'
import { CardIdentifier, CCGCard, CCGCardEffect, CCGCondition } from '../commands/ccg/ccgInterface'
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

/** Per-series rarity blank overrides */
const SERIES_RARITY_BLANK: Record<string, Record<string, string>> = {
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

        const allCards = cards ?? [...mazariniCCG, ...swCCG]
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

        const overlaySvg = CCGCardGenerator.buildOverlaySVG(modified, richSpans)
        layers.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 })

        const baseBuffer = await base.toBuffer()
        return await sharp(baseBuffer).composite(layers).png().toBuffer()
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
        await sharp(baseBuffer).composite(layers).png().toFile(outputPath)
    }

    /** Build a transparent SVG overlay with stats, card name, and effect description */
    private static buildOverlaySVG(card: CCGCard, richSpans: TextSpan[]): string {
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
                `Reduce [blue]all[/blue] card costs by [blue]${effects[0].value}[/blue] for [pink]${effects[0].turns} turns[/pink]`
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
                const cardName = [...mazariniCCG, ...swCCG].find((c) => c.id === condition.cardId)?.name ?? condition.cardId
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
            case 'GAIN_ENERGY':
                if (effect.turns && effect.delayedTrigger) return `Gain [blue]${effect.value} energy[/blue] in [pink]${effect.turns} turns[/pink]`
                return effect.turns
                    ? `Gain [blue]${effect.value} energy[/blue] for [pink]${effect.turns} turns[/pink]`
                    : `Gain [blue]${effect.value} energy[/blue]`
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
            case 'REFLECT':
                return effect.turns
                    ? `Reflect the [red]first incoming damage[/red] for [pink]${effect.turns} turn${effect.turns !== 1 ? 's' : ''}[/pink]`
                    : `Reflect the [red]first incoming damage[/red]`
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
            case 'REDUCE_COST':
                return `Reduce ${tgtPossessive} ${effect.identifier ? `[yellow]${effect.identifier}[/yellow] ` : ''}card costs by [blue]${
                    effect.value
                }[/blue] for [pink]${effect.turns} turns[/pink]`
            case 'SPEED_BUFF':
                return `Increase [pink]${tgtPossessive}[/pink] speed ([green]+50%[/green]) for [pink]${effect.turns} turns[/pink]`
            case 'RECOVER':
                return `Heal [green]${effect.value}[/green] each turn for [pink]${effect.turns} turns[/pink]`
            case 'DAMAGE_BOOST':
                return `Boost ${tgtPossessive} direct damage by [red]+${effect.value}[/red] for [pink]${effect.turns} turns[/pink]`
            case 'EXTRA_CARDS':
                return `Play [blue]${effect.value} cards[/blue] for [pink]${effect.turns} turns[/pink]`
            case 'TRANSFORM':
                return effect.transformCardId
                    ? `Transform into [yellow]${effect.transformCardId}[/yellow] with ${effect.accuracy}% chance`
                    : `Transform (unknown card)`
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
                    ? `Summon [yellow]${[...mazariniCCG, ...swCCG].find((c) => c.id === effect.summonCardId)?.name ?? effect.summonCardId}[/yellow] to hand`
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
}

interface TextSpan {
    text: string
    color: string
}
