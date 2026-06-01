import * as path from 'path'
import sharp = require('sharp')

const BLANKS_DIR = path.resolve('res/ccg/blanks/hp')
const CARD_WIDTH = 480
const CARD_HEIGHT = 672
const BORDER_RADIUS = 16

const BLANKS = ['hp_common_blank.png', 'hp_rare_blank.png', 'hp_epic_blank.png', 'hp_legendary_blank.png']

const mask = Buffer.from(
    `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}">
        <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="${BORDER_RADIUS}" ry="${BORDER_RADIUS}" fill="white"/>
    </svg>`
)

async function processBlank(filename: string) {
    const filePath = path.join(BLANKS_DIR, filename)
    const tmpPath = filePath + '.tmp.png'
    await sharp(filePath)
        .resize(CARD_WIDTH, CARD_HEIGHT)
        .composite([{ input: mask, blend: 'dest-in' }])
        .png()
        .toFile(tmpPath)
    const fs = require('fs')
    fs.renameSync(tmpPath, filePath)
    console.log(`Processed: ${filename}`)
}

async function main() {
    for (const blank of BLANKS) {
        await processBlank(blank)
    }
    console.log('Done — all HP blanks cropped.')
}

main().catch(console.error)
