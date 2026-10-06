// Server-only. "Velg MOL": a token (users/{id}/molTokens, from a Deal or No Deal effect or a chest) that lets its owner pick tomorrow's
// More or Less category - any of them, blacklisted ones too. Only one pick per day: the first one locks it.
//
// Stored where the bot keeps its shared More or Less state (MazariniStorage.moreOrLess in the bot's interfaces/database/databaseInterface.ts):
//   other/moreOrLess/forcedNext     the chosen category - the 05:00 job uses it over any vote (the same field /admin moreorless next sets)
//   other/moreOrLess/forcedNextBy   who chose it. Its existence IS the lock; the bot reads it to disable the vote buttons and to skip
//                                   the "ban yesterday's category" vote on the day the category is played. Cleared by the 05:00 job.

import { increment } from "firebase/database"
import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { CUSTOM_MOL_GAME_TAG } from "./gameValues"

import allCustomGames from "@/data/more-or-less/allCustomGames.json"
import { loadCustomCategory } from "./moreOrLessHandler"

const MOL_PATH = "other/moreOrLess"
const LOCK_PATH = `${MOL_PATH}/forcedNextBy`
const TOKENS_PATH = (userId: string) => `users/${userId}/molTokens`
const API_LIST_URL = "https://api.moreorless.io/en/games.json"

interface MolCategory {
  slug: string
  title: string
  description?: string
  image?: string
  tags?: string[]
  strings?: { verb: string; valueTitle: string; valueSuffix?: string; buttonMore?: string; buttonLess?: string }
}

export interface ForcedNextBy {
  id: string
  name: string
  at: number
}

const err = (message: string, status = 400) => Response.json({ error: message }, { status })

/** Every category there is - the ones from the More or Less API and our own custom ones, blacklisted or not. */
async function allCategories(): Promise<MolCategory[]> {
  const custom = allCustomGames as MolCategory[]
  let api: MolCategory[] = []
  try {
    const res = await fetch(API_LIST_URL, { headers: { Accept: "application/json" }, next: { revalidate: 3600 } })
    if (res.ok) api = await res.json()
  } catch {
    // The API being down only costs us its categories - the custom ones can still be picked.
  }
  return [...api, ...custom]
}

/** The category exactly as the bot's own validateGame hands it on (strings filled in), or null if it can't be played. */
async function validated(category: MolCategory): Promise<MolCategory | null> {
  if (category.tags?.includes(CUSTOM_MOL_GAME_TAG)) {
    // Custom games are played from the app's own copy of the data - one the app doesn't have can't be played here, so can't be picked.
    const custom = loadCustomCategory(category.slug)
    if (!custom) return null
    return { ...category, strings: custom.strings ?? category.strings }
  }
  try {
    const res = await fetch(`https://api.moreorless.io/en/games/${category.slug}.json`, { headers: { Accept: "application/json" }, next: { revalidate: 3600 } })
    if (!res.ok) return null
    const game = (await res.json()).game
    // Rows are [subject, value, image, ...] with an optional ready-made value text in the fifth column - more than that is a kind we don't know.
    if (!game?.data?.[0] || game.data[0].length > 5) return null
    return { ...category, strings: game.strings }
  } catch {
    return null
  }
}

/** Only the categories that can actually be played - offering one that can't (Historical Happenings, say) just ends in an error after Bekreft.
 * Every one is checked, a few at a time; the answers are cached for an hour, so this is a second or so for the first person and free for the rest. */
async function playableCategories(): Promise<MolCategory[]> {
  const queue = [...(await allCategories())]
  const playable: MolCategory[] = []
  await Promise.all(
    Array.from({ length: 12 }, async () => {
      for (let category = queue.pop(); category; category = queue.pop()) {
        if (await validated(category)) playable.push(category)
      }
    })
  )
  return playable
}

const nameOf = (user: AuthenticatedDiscordUser) => user.globalName ?? user.username

export async function getMolChoiceStatus(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const [tokens, lockedBy]: [number | undefined, ForcedNextBy | undefined] = await Promise.all([
    firebase.getData(TOKENS_PATH(user.id)),
    firebase.getData(LOCK_PATH),
  ])
  const owned = typeof tokens === "number" && tokens > 0 ? tokens : 0
  // The (long) list is only needed by someone who can actually use it.
  const categories = owned > 0 && !lockedBy ? (await playableCategories()).map((c) => ({ slug: c.slug, title: c.title })).sort((a, b) => a.title.localeCompare(b.title, "nb")) : []
  return Response.json({ tokens: owned, lockedBy: lockedBy ? { id: lockedBy.id, name: lockedBy.name } : null, categories })
}

export async function chooseMolCategory(user: AuthenticatedDiscordUser, slug: string) {
  const firebase = new FirebaseHelper()
  const tokens = await firebase.getData(TOKENS_PATH(user.id))
  if (!(typeof tokens === "number" && tokens > 0)) return err("Du har ingen Velg MOL-token")

  const category = (await allCategories()).find((c) => c.slug === slug)
  if (!category) return err("Fant ikke kategorien")
  const game = await validated(category)
  if (!game) return err("Den kategorien kan ikke spilles akkurat nå - velg en annen")

  // Whoever gets here first locks the day - an atomic claim, so two tokens used at the same moment can't both go through.
  const by: ForcedNextBy = { id: user.id, name: nameOf(user), at: Date.now() }
  if (!(await firebase.claim(LOCK_PATH, by))) {
    const winner: ForcedNextBy | undefined = await firebase.getData(LOCK_PATH)
    return err(`Morgendagens kategori har allerede blitt bestemt av ${winner?.name ?? "noen andre"}`, 409)
  }
  // Only the winner of the claim gets here, so spending the token and setting the category can't be done twice.
  await firebase.updateData({ [`${MOL_PATH}/forcedNext`]: game, [TOKENS_PATH(user.id)]: increment(-1) })
  return Response.json({ chosen: { slug: game.slug, title: game.title }, tokens: tokens - 1 })
}
