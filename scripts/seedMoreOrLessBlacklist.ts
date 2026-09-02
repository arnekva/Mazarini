/**
 * One-off migration: pushes the old hardcoded More or Less blacklist (MoreOrLess.defaultBlacklistSeed)
 * into firebase (other/moreOrLess/blacklist), merged with whatever is already there, so previously
 * excluded categories can't reappear now that the exclusion list lives in the DB instead of in code.
 *
 * Dry-run (default): reports what WOULD change, writes nothing.
 *   DATABASE=prod npx ts-node scripts/seedMoreOrLessBlacklist.ts
 * Apply for real:
 *   DATABASE=prod npx ts-node scripts/seedMoreOrLessBlacklist.ts --apply
 */
import 'dotenv/config'
import { initializeApp } from 'firebase/app'
import { get, getDatabase, ref, update } from 'firebase/database'
import { database, firebaseConfig } from '../client-env'
import { MoreOrLess } from '../commands/games/moreOrLess'

const APPLY = process.argv.includes('--apply')

async function run() {
    console.log(`Target DB path: "${database}/other/moreOrLess"  |  Mode: ${APPLY ? 'APPLY (writes!)' : 'DRY-RUN'}`)

    const app = initializeApp(firebaseConfig)
    const db = getDatabase(app)
    const snap = await get(ref(db, `${database}/other/moreOrLess`))
    const moreOrLess: any = snap.val() ?? {}
    const existing: string[] = moreOrLess.blacklist ?? []

    const merged = Array.from(new Set([...existing, ...MoreOrLess.defaultBlacklistSeed]))
    const added = merged.filter((slug) => !existing.includes(slug))

    console.log(`Existing blacklist entries: ${existing.length}`)
    console.log(`Seed entries to add: ${added.length > 0 ? added.join(', ') : '(none - already up to date)'}`)
    console.log(`Total after merge: ${merged.length}`)

    if (APPLY && added.length > 0) {
        await update(ref(db, `${database}/other/moreOrLess`), { blacklist: merged })
        console.log('DB updated.')
    } else if (APPLY) {
        console.log('Nothing to write, blacklist already up to date.')
    }
    process.exit(0)
}

run().catch((e) => {
    console.error(e)
    process.exit(1)
})
