// Server-only. The admin-picked daily gift: the admin (see /admin) chooses a set of prizes, and everyone on the recipient list gets
// to pick ONE of them from their Daily claim page. Each time the admin publishes, a new round starts and everyone can pick again.
//
// Stored where the bot keeps its shared storage (MazariniStorage.dailyGift / MazariniUser.claimedGift in the bot's
// interfaces/database/databaseInterface.ts - keep the shapes in step):
//   other/dailyGift                  the current round: its options and who it's for
//   other/dailyGift/claims/{userId}  what each person picked - written once, atomically, so a double-click can't claim twice
//   users/{userId}/claimedGift       the round id of the last gift that person claimed

import { increment } from "firebase/database"
import { after } from "next/server"
import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { announceInChannel, lootButtonComponent } from "./discordMessage"

export type GiftKind = "dond" | "box" | "chest" | "chips" | "spin" | "pot"
export type GiftQuality = "basic" | "premium" | "elite"

export interface DailyGiftOption {
  /** Unique within a round, e.g. "dond-elite", "chips". */
  id: string
  kind: GiftKind
  quality?: GiftQuality
  /** Chips and pot only. */
  amount?: number
}

export interface DailyGiftClaim {
  optionId: string
  at: number
}

export interface DailyGift {
  roundId: string
  options: DailyGiftOption[]
  recipients: string[]
  createdAt: number
  claims?: Record<string, DailyGiftClaim>
}

/** Who the gifts were first set up for - what the admin panel starts with when nothing has been published yet. */
export const DEFAULT_GIFT_RECIPIENTS = ["397429060898390016", "245607554254766081", "293489109048229888", "715963046861865091", "239154365443604480"]

export const GIFT_PATH = "other/dailyGift"

const QUALITY_NAMES: Record<GiftQuality, string> = { basic: "Basic", premium: "Premium", elite: "Elite" }
/** What each Deal or No Deal tier's top prize is (see dondValues in gameValues.ts) - how people know them. */
const DOND_TOP_PRIZE: Record<GiftQuality, string> = { basic: "10k", premium: "20k", elite: "50k" }

export function giftLabel(option: DailyGiftOption): string {
  const quality = option.quality ?? "basic"
  switch (option.kind) {
    case "dond":
      return `Deal or No Deal (${DOND_TOP_PRIZE[quality]})`
    case "box":
      return `${QUALITY_NAMES[quality]} lootbox`
    case "chest":
      return `${QUALITY_NAMES[quality]} loot chest`
    case "chips":
      return `${(option.amount ?? 0).toLocaleString("nb-NO")} chips`
    case "spin":
      return "Ekstra spinn på Lykkehjulet"
    case "pot":
      return `Legg til ${(option.amount ?? 0).toLocaleString("nb-NO")} i deathroll-potten`
  }
}

export function giftIcon(option: DailyGiftOption): string {
  return { dond: "💼", box: "📦", chest: "🎁", chips: "🪙", spin: "🎡", pot: "💀" }[option.kind]
}

const QUALITIES: GiftQuality[] = ["basic", "premium", "elite"]

/** Checks and cleans up what the admin panel sent: only known kinds, a sensible chips amount, no duplicates. */
export function parseGiftOptions(raw: unknown): DailyGiftOption[] | string {
  if (!Array.isArray(raw)) return "Ugyldige gaver"
  const options: DailyGiftOption[] = []
  for (const item of raw) {
    const kind = item?.kind as GiftKind
    if (kind === "dond" || kind === "box" || kind === "chest") {
      if (!QUALITIES.includes(item.quality)) return `Ugyldig kvalitet for ${kind}`
      options.push({ id: `${kind}-${item.quality}`, kind, quality: item.quality })
    } else if (kind === "chips") {
      const amount = Math.floor(Number(item.amount))
      if (!(amount > 0) || amount > 10_000_000) return "Chips må være et tall over 0"
      options.push({ id: "chips", kind, amount })
    } else if (kind === "pot") {
      const amount = Math.floor(Number(item.amount))
      if (!(amount > 0) || amount > 10_000_000) return "Potten må få et tall over 0"
      options.push({ id: "pot", kind, amount })
    } else if (kind === "spin") {
      options.push({ id: "spin", kind })
    } else return `Ukjent gavetype: ${kind}`
  }
  const unique = options.filter((o, i) => options.findIndex((p) => p.id === o.id) === i)
  return unique.length > 0 ? unique : "Velg minst én gave"
}

export function parseRecipients(raw: unknown): string[] | string {
  if (!Array.isArray(raw)) return "Ugyldige mottakere"
  const ids = [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))]
  if (ids.some((id) => !/^\d{17,20}$/.test(id))) return "Mottakere må være Discord-ID-er (bare tall)"
  return ids.length > 0 ? ids : "Legg til minst én mottaker"
}

export async function readDailyGift(firebase: FirebaseHelper): Promise<DailyGift | null> {
  const raw = await firebase.getData(GIFT_PATH)
  if (!raw?.roundId) return null
  return { roundId: raw.roundId, options: raw.options ?? [], recipients: raw.recipients ?? [], createdAt: raw.createdAt ?? 0, claims: raw.claims ?? {} }
}

/** Hands the chosen prize over. Called once, after the claim itself has gone through. */
export async function grantGift(firebase: FirebaseHelper, user: AuthenticatedDiscordUser, option: DailyGiftOption) {
  const updates: Record<string, unknown> = {}
  if (option.kind === "dond") updates[`dondTokens/${option.quality}`] = increment(1)
  if (option.kind === "chips") updates.chips = increment(option.amount ?? 0)
  if (option.kind === "spin") {
    // A user with no dailySpins at all has 1 (see the wheel-spin route), so an increment from nothing would leave them at 1, not 2.
    const spins = await firebase.getData(`users/${user.id}/dailySpins`)
    updates.dailySpins = typeof spins === "number" ? increment(1) : 2
  }
  if (Object.keys(updates).length > 0) await firebase.updateUserFields(user.id, updates)
  // Not a user field: goes through the pending pot (a server-side atomic increment), so any number of people picking this at the same
  // moment all add up, and the bot's live listener drains it into its in-memory pot right away.
  if (option.kind === "pot") await firebase.addToDeathrollPot(option.amount ?? 0)

  // Announced in the channel the Activity was started from. A box or chest is opened the usual way, with the bot's "Open loot"
  // button on the same message.
  const loot = option.kind === "box" || option.kind === "chest" ? option.kind : undefined
  after(() =>
    announceInChannel(user.channelId, {
      content:
        option.kind === "pot"
          ? `${giftIcon(option)} <@${user.id}> har åpnet gaven og la **${(option.amount ?? 0).toLocaleString("nb-NO")}** chips i deathroll-potten!`
          : `${giftIcon(option)} <@${user.id}> har åpnet gaven og fikk **${giftLabel(option)}**!`,
      ...(loot ? { components: [lootButtonComponent(user.id, option.quality ?? "basic", loot)] } : {}),
    })
  )
}
