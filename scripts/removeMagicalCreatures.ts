/**
 * One-off cleanup: Magical Creature cards (identifier MAGICAL_CREATURE, collectible:false) leaked into
 * packs. This removes any found in user inventories and grants 50 shards per removed copy.
 *
 * Dry-run (default): reports what WOULD change, writes nothing.
 *   DATABASE=prod npx ts-node scripts/removeMagicalCreatures.ts
 * Apply for real:
 *   DATABASE=prod npx ts-node scripts/removeMagicalCreatures.ts --apply
 */
import 'dotenv/config'
import { initializeApp } from 'firebase/app'
import { get, getDatabase, ref, update } from 'firebase/database'
import { database, firebaseConfig } from '../client-env'
import { hpCCG } from '../commands/ccg/cards/hpCCG'

const SHARDS_PER_CARD = 50
const APPLY = process.argv.includes('--apply')
const mcIds = new Set(hpCCG.filter((c) => c.identifier?.includes('MAGICAL_CREATURE')).map((c) => c.id))

async function run() {
    console.log(`Target DB path: "${database}/users"  |  Mode: ${APPLY ? 'APPLY (writes!)' : 'DRY-RUN'}`)
    console.log(`Magical Creature ids: ${[...mcIds].join(', ')}\n`)

    const app = initializeApp(firebaseConfig)
    const db = getDatabase(app)
    const snap = await get(ref(db, `${database}/users`))
    const users: Record<string, any> = snap.val() ?? {}

    let affected = 0
    let totalCards = 0
    let totalShards = 0
    const updates: Record<string, any> = {}

    for (const [uid, user] of Object.entries<any>(users)) {
        let removed = 0
        const loot = user?.loot
        if (loot) {
            for (const series of Object.keys(loot)) {
                const inv = loot[series]?.inventory
                if (!inv) continue
                for (const rarity of Object.keys(inv)) {
                    const items = inv[rarity]?.items
                    if (!Array.isArray(items)) continue
                    const kept = items.filter((it: any) => !mcIds.has(it?.name))
                    const removedHere = items.filter((it: any) => mcIds.has(it?.name))
                    if (removedHere.length > 0) {
                        removed += removedHere.reduce((s: number, it: any) => s + (it.amount ?? 0), 0)
                        inv[rarity].items = kept
                    }
                }
            }
        }
        if (removed > 0) {
            const shards = removed * SHARDS_PER_CARD
            affected++
            totalCards += removed
            totalShards += shards
            console.log(`  ${user?.displayName ?? user?.name ?? uid}: -${removed} card(s)  +${shards} shards`)
            if (APPLY) {
                user.ccg = user.ccg ?? {}
                user.ccg.shards = (user.ccg.shards ?? 0) + shards
                updates[`${database}/users/${uid}`] = user
            }
        }
    }

    console.log(
        `\n=== ${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${affected} user(s), ${totalCards} card(s) removed, ${totalShards} shards granted (${SHARDS_PER_CARD}/copy) ===`
    )
    if (APPLY && Object.keys(updates).length > 0) {
        await update(ref(db), updates)
        console.log('DB updated.')
    }
    process.exit(0)
}

run().catch((e) => {
    console.error(e)
    process.exit(1)
})
