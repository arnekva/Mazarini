/**
 * Root-cause fix for Hermione Granger (hp_hermione_n) Epic -> Legendary rarity change.
 *
 * The previous refundHermione.ts script deleted existing copies, but the loot-series document
 * at /other/loot/series (which controls which rarity pool a pack pull draws from) was never
 * re-synced from the updated card data. So packs kept rolling Hermione out of the "epic" pool
 * and filing new copies into inventory.epic.items even after the code-side rarity change and
 * the refund.
 *
 * This script does two things:
 *   1. Moves "hp_hermione_n" out of hpCCG series.epic and into series.legendary in
 *      /other/loot/series, so future pack pulls draw her from the correct pool.
 *   2. Migrates any existing inventory.epic.items entries for hp_hermione_n (for every user)
 *      into inventory.legendary.items, merging amounts with any existing legendary entry.
 *
 * Dry-run (default): reports what WOULD change, writes nothing.
 *   DATABASE=prod npx ts-node scripts/migrateHermioneToLegendary.ts
 * Apply for real:
 *   DATABASE=prod npx ts-node scripts/migrateHermioneToLegendary.ts --apply
 */
import 'dotenv/config'
import { initializeApp } from 'firebase/app'
import { get, getDatabase, ref, update } from 'firebase/database'
import { database, firebaseConfig } from '../client-env'

const CARD_ID = 'hp_hermione_n'
const SERIES_NAME = 'hpCCG'
const APPLY = process.argv.includes('--apply')

async function run() {
    console.log(`Target DB path: "${database}"  |  Mode: ${APPLY ? 'APPLY (writes!)' : 'DRY-RUN'}\n`)

    const app = initializeApp(firebaseConfig)
    const db = getDatabase(app)
    const updates: Record<string, any> = {}

    // 1. Fix the loot series pool so future pack pulls file Hermione as legendary.
    const seriesSnap = await get(ref(db, `${database}/other/loot/series`))
    const allSeries: any[] = seriesSnap.val() ?? []
    const hpSeries = allSeries.find((s) => s?.name === SERIES_NAME)
    if (!hpSeries) {
        console.log(`No "${SERIES_NAME}" series found at ${database}/other/loot/series — skipping series fix.`)
    } else {
        const inEpic = (hpSeries.epic ?? []).includes(CARD_ID)
        const inLegendary = (hpSeries.legendary ?? []).includes(CARD_ID)
        if (inEpic || !inLegendary) {
            console.log(`Series fix: hpCCG.epic ${inEpic ? 'contains' : 'does not contain'} ${CARD_ID} (will remove)`)
            console.log(`Series fix: hpCCG.legendary ${inLegendary ? 'already contains' : 'missing'} ${CARD_ID} (will ensure present)`)
            if (APPLY) {
                hpSeries.epic = (hpSeries.epic ?? []).filter((id: string) => id !== CARD_ID)
                hpSeries.legendary = inLegendary ? hpSeries.legendary : [...(hpSeries.legendary ?? []), CARD_ID]
                const updatedSeries = allSeries.map((s) => (s.name === SERIES_NAME ? hpSeries : s))
                updates[`${database}/other/loot/series`] = updatedSeries
            }
        } else {
            console.log('Series fix: already correct, nothing to do.')
        }
    }

    // 2. Migrate any stray inventory.epic.items copies into inventory.legendary.items.
    const usersSnap = await get(ref(db, `${database}/users`))
    const users: Record<string, any> = usersSnap.val() ?? {}

    let affectedUsers = 0
    let totalMigrated = 0

    for (const [uid, user] of Object.entries<any>(users)) {
        const inv = user?.loot?.[SERIES_NAME]?.inventory
        const epicItems = inv?.epic?.items
        if (!Array.isArray(epicItems)) continue

        const stray = epicItems.filter((it: any) => it?.name === CARD_ID)
        if (stray.length === 0) continue

        const strayAmount = stray.reduce((s: number, it: any) => s + (it.amount ?? 0), 0)
        affectedUsers++
        totalMigrated += strayAmount
        console.log(`  ${user?.displayName ?? user?.name ?? uid}: moving ${strayAmount} copy/copies epic -> legendary`)

        if (APPLY) {
            inv.epic.items = epicItems.filter((it: any) => it?.name !== CARD_ID)

            inv.legendary = inv.legendary ?? { items: [], img: '' }
            const legendaryItems: any[] = inv.legendary.items ?? []
            const existing = legendaryItems.find((it: any) => it?.name === CARD_ID)
            if (existing) {
                existing.amount = (existing.amount ?? 0) + strayAmount
            } else {
                legendaryItems.push({ name: CARD_ID, series: SERIES_NAME, rarity: 'legendary', color: stray[0].color ?? 'none', amount: strayAmount, isCCG: true })
            }
            inv.legendary.items = legendaryItems

            updates[`${database}/users/${uid}/loot/${SERIES_NAME}/inventory`] = inv
        }
    }

    console.log(
        `\n=== ${APPLY ? 'APPLIED' : 'DRY-RUN'}: series pool ${
            hpSeries ? 'checked' : 'skipped'
        }, ${affectedUsers} user(s) with ${totalMigrated} stray copy/copies migrated ===`
    )
    if (APPLY && Object.keys(updates).length > 0) {
        await update(ref(db), updates)
        console.log('DB updated.')
    } else if (!APPLY) {
        console.log('Re-run with --apply to write these changes.')
    }
    process.exit(0)
}

run().catch((e) => {
    console.error(e)
    process.exit(1)
})
