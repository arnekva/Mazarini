// Port of commands/games/content/dondItems.ts from the bot repo. The bot's version mutates a
// MazariniUser in memory and saves it; here every effect is expressed as the Firebase field updates
// it makes (nested paths, so concurrent bot writes to other fields are left alone), plus the two
// things that can't be a plain user-field write: a deathroll pot top-up and a loot chest/box.

export interface DondEffect {
  id: string
  label: string
  /** Field updates on users/{id} - `user` is the current DB user, for read-modify-write additions. */
  apply: (user: any) => Record<string, unknown>
  potAdd?: number
  loot?: { type: "box" | "chest"; quality: "basic" | "premium" | "elite" }
}

type Tier = "veryLow" | "low" | "medium" | "high"

const buff = (key: string, amount: number, label: string): Omit<DondEffect, "id"> => ({
  label,
  apply: (user) => ({ [`effects/positive/${key}`]: (user.effects?.positive?.[key] ?? 0) + amount }),
})

const pot = (amount: number): Omit<DondEffect, "id"> => ({
  label: `${amount} til deathroll potten`,
  apply: () => ({}),
  potAdd: amount,
})

/** The bot's `/spin` effects overwrite dailySpins rather than adding to it - kept identical. */
const spins = (n: number): Omit<DondEffect, "id"> => ({ label: `${n} spin`, apply: () => ({ dailySpins: n }) })

const box = (quality: "basic" | "premium" | "elite"): Omit<DondEffect, "id"> => ({
  label: `${quality} lootbox!`,
  apply: () => ({}),
  loot: { type: "box", quality },
})

const chest = (quality: "basic" | "premium" | "elite"): Omit<DondEffect, "id"> => ({
  label: `${quality} lootchest!`,
  apply: () => ({}),
  loot: { type: "chest", quality },
})

const raw: Record<Tier, Omit<DondEffect, "id">[]> = {
  veryLow: [pot(5000), buff("blackjackReDeals", 3, "1 Blackjack re-deal"), buff("doublePotWins", 2, "2x doubled potwins")],
  low: [pot(10000), buff("blackjackReDeals", 2, "2 Blackjack re-deal"), spins(1), box("basic")],
  medium: [
    pot(15000),
    spins(2),
    buff("freeRolls", 15, "15 free rolls"),
    { label: "Flipped color odds", apply: () => ({ "effects/positive/lootColorsFlipped": true }) },
    buff("guaranteedLootColor", 1, "1x guaranteed colors"),
    box("premium"),
    chest("basic"),
  ],
  high: [pot(30000), spins(5), buff("guaranteedLootColor", 3, "3x guaranteed colors"), box("elite"), chest("premium")],
}

const byTier: Record<Tier, DondEffect[]> = {
  veryLow: raw.veryLow.map((e, i) => ({ ...e, id: `veryLow:${i}` })),
  low: raw.low.map((e, i) => ({ ...e, id: `low:${i}` })),
  medium: raw.medium.map((e, i) => ({ ...e, id: `medium:${i}` })),
  high: raw.high.map((e, i) => ({ ...e, id: `high:${i}` })),
}

/** Which effect pool a bank offer draws from, based on what the chip offer would have been. */
export function effectPoolForOffer(chipOffer: number): DondEffect[] {
  if (chipOffer > 7000) return byTier.high
  if (chipOffer > 3500) return byTier.medium
  if (chipOffer < 500) return byTier.veryLow
  return byTier.low
}

export function findEffect(id: string): DondEffect | undefined {
  return Object.values(byTier)
    .flat()
    .find((e) => e.id === id)
}
