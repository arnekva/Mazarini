/**
 * generateBlanks.ts
 *
 * Standalone script to generate programmatic card blanks from a background image.
 * Edit the configuration block below, then run with:
 *
 *   npx ts-node scripts/generateBlanks.ts
 *
 * The script generates one blank PNG per rarity (common / rare / epic / legendary)
 * and saves them to OUTPUT_DIR with the specified FILENAME_PREFIX.
 */

import * as fs from 'fs'
import * as path from 'path'
import { CCGCardGenerator } from '../helpers/ccgCardGenerator'
import { ItemRarity } from '../interfaces/database/databaseInterface'

// ─── CONFIGURATION — edit these ──────────────────────────────────────────────

/**
 * Full-card background image. This is stretched to fill all 480×672px.
 * The portrait area is transparent in the frame, so whatever is here shows
 * through. Swap this per series (HP castle, SW starfield, etc.).
 * The lower text area gets a dark overlay automatically — no second image needed.
 */
const BACKGROUND_IMAGE = path.resolve('res/ccg/blanks/hoggy.webp')

/** Directory where the generated blank PNGs will be saved. */
const OUTPUT_DIR = path.resolve('res/ccg/blanks/generated')

/** Filename prefix. Output files will be named e.g. 'mycard_common_blank.png'. */
const FILENAME_PREFIX = 'mycard'

/** Override accent colours per rarity. Leave as undefined to use the defaults:
 *  common: #7f9bb5 | rare: #1a92ce | epic: #9b59b6 | legendary: #c8a000 */
const ACCENT_OVERRIDES: Partial<Record<ItemRarity, string>> = {
    // [ItemRarity.Common]:    '#7f9bb5',
    // [ItemRarity.Rare]:      '#1a92ce',
    // [ItemRarity.Epic]:      '#9b59b6',
    // [ItemRarity.Legendary]: '#c8a000',
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    if (!fs.existsSync(BACKGROUND_IMAGE)) {
        console.error(`Background image not found: ${BACKGROUND_IMAGE}`)
        process.exit(1)
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true })
        console.log(`Created output directory: ${OUTPUT_DIR}`)
    }

    const bgBuffer = fs.readFileSync(BACKGROUND_IMAGE)
    console.log(`Loaded background: ${BACKGROUND_IMAGE}`)

    const rarities = [ItemRarity.Common, ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary]

    for (const rarity of rarities) {
        const accentOverride = ACCENT_OVERRIDES[rarity]
        const blank = await CCGCardGenerator.generateBlankBuffer(bgBuffer, rarity, accentOverride)
        const filename = `${FILENAME_PREFIX}_${rarity}_blank.png`
        const outPath = path.resolve(OUTPUT_DIR, filename)
        fs.writeFileSync(outPath, blank)
        console.log(`Generated: ${outPath}`)
    }

    console.log('Done.')
}

main().catch((err) => {
    console.error('Error generating blanks:', err)
    process.exit(1)
})
