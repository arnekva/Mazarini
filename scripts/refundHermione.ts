/**
 * One-off refund: Hermione Granger (hp_hermione_n) has been moved to Legendary rarity.
 * This removes all copies from user inventories and decks, granting 50 shards per copy removed.
 *
 * Dry-run (default): reports what WOULD change, writes nothing.
 *   DATABASE=prod npx ts-node scripts/refundHermione.ts
 * Apply for real:
 *   DATABASE=prod npx ts-node scripts/refundHermione.ts --apply
 */
import 'dotenv/config'
import { initializeApp } from 'firebase/app'
import { get, getDatabase, ref, update } from 'firebase/database'
import { database, firebaseConfig } from '../client-env'

const CARD_ID = 'hp_hermione_n'
const SHARDS_PER_COPY = 50
const APPLY = process.argv.includes('--apply')

async function run() {
    console.log(`Target DB path: "${database}/users"  |  Mode: ${APPLY ? 'APPLY (writes!)' : 'DRY-RUN'}\n`)

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

        // Remove from inventory
        const loot = user?.loot
        if (loot) {
            for (const series of Object.keys(loot)) {
                const inv = loot[series]?.inventory
                if (!inv) continue
                for (const rarity of Object.keys(inv)) {
                    const items = inv[rarity]?.items
                    if (!Array.isArray(items)) continue
                    const removedHere = items.filter((it: any) => it?.name === CARD_ID)
                    if (removedHere.length > 0) {
                        removed += removedHere.reduce((s: number, it: any) => s + (it.amount ?? 0), 0)
                        inv[rarity].items = items.filter((it: any) => it?.name !== CARD_ID)
                    }
                }
            }
        }

        // Remove from decks
        const decks: any[] = user?.ccg?.decks ?? []
        for (const deck of decks) {
            const before = deck.cards?.length ?? 0
            deck.cards = (deck.cards ?? []).filter((c: any) => c?.id !== CARD_ID)
            const removedFromDeck = before - deck.cards.length
            if (removedFromDeck > 0) {
                removed += removedFromDeck
                deck.valid = false
            }
        }

        if (removed > 0) {
            const shards = removed * SHARDS_PER_COPY
            affected++
            totalCards += removed
            totalShards += shards
            console.log(`  ${user?.displayName ?? user?.name ?? uid}: -${removed} copy/copies  +${shards} shards`)
            if (APPLY) {
                user.ccg = user.ccg ?? {}
                user.ccg.shards = (user.ccg.shards ?? 0) + shards
                updates[`${database}/users/${uid}`] = user
            }
        }
    }

    console.log(
        `\n=== ${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${affected} user(s), ${totalCards} copy/copies removed, ${totalShards} shards granted (${SHARDS_PER_COPY}/copy) ===`
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
