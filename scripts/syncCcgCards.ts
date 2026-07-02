/**
 * Sync the code CCG card definitions to the DB (storage at `${database}/other/ccg`).
 * Dry-run (default) prints a diff vs. what's currently in the DB; --apply writes it.
 *   DATABASE=prod npx ts-node scripts/syncCcgCards.ts
 *   DATABASE=prod npx ts-node scripts/syncCcgCards.ts --apply
 */
import 'dotenv/config'
import { initializeApp } from 'firebase/app'
import { get, getDatabase, ref, update } from 'firebase/database'
import { database, firebaseConfig } from '../client-env'
import { hpCCG } from '../commands/ccg/cards/hpCCG'
import { mazariniCCG } from '../commands/ccg/cards/mazariniCCG'
import { swCCG } from '../commands/ccg/cards/swCCG'

const APPLY = process.argv.includes('--apply')
// JSON round-trip strips `undefined` (Firebase rejects it) and gives plain objects.
const codeCcg: Record<string, any[]> = JSON.parse(JSON.stringify({ mazariniCCG, swCCG, hpCCG }))

async function run() {
    console.log(`Target: ${database}/other/ccg  |  Mode: ${APPLY ? 'APPLY (writes!)' : 'DRY-RUN'}\n`)
    const app = initializeApp(firebaseConfig)
    const db = getDatabase(app)
    const dbCcg: Record<string, any[]> = (await get(ref(db, `${database}/other/ccg`))).val() ?? {}

    for (const series of Object.keys(codeCcg)) {
        const codeCards = codeCcg[series] ?? []
        const dbCards = dbCcg[series] ?? []
        const codeById = new Map(codeCards.map((c) => [c.id, c]))
        const dbById = new Map(dbCards.map((c) => [c.id, c]))

        const added = codeCards.filter((c) => !dbById.has(c.id)).map((c) => c.id)
        const removed = dbCards.filter((c) => !codeById.has(c.id)).map((c) => c.id)
        const changed = codeCards.filter((c) => dbById.has(c.id) && JSON.stringify(dbById.get(c.id)) !== JSON.stringify(c)).map((c) => c.id)

        console.log(`[${series}] db:${dbCards.length} -> code:${codeCards.length}`)
        if (added.length) console.log(`   + added:   ${added.join(', ')}`)
        if (removed.length) console.log(`   - REMOVED: ${removed.join(', ')}`)
        if (changed.length) console.log(`   ~ changed: ${changed.join(', ')}`)
        if (!added.length && !removed.length && !changed.length) console.log('   (no changes)')
    }

    if (APPLY) {
        await update(ref(db), { [`${database}/other/ccg`]: codeCcg })
        console.log('\n✓ CCG definitions written to DB. (Bot picks them up on next restart/deploy.)')
    } else {
        console.log('\nDry-run only — nothing written. Re-run with --apply to write.')
    }
    process.exit(0)
}

run().catch((e) => {
    console.error(e)
    process.exit(1)
})
