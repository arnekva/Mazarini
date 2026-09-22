import fs from "fs"
import path from "path"
import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { CUSTOM_MOL_GAME_TAG, moreOrLessValues } from "./gameValues"

interface MolItem { subject: string; answer: number; image: string }
interface MolCategory { slug: string; title: string; description: string; image: string; tags?: string[]; totalEntries?: number; strings?: { verb: string; valueTitle: string; valueSuffix?: string; buttonMore?: string; buttonLess?: string } }
interface MolSession { slug: string; data: MolItem[]; current: MolItem; next: MolItem; correctAnswers: number }
interface MolStat { attempted?: boolean; firstAttempt?: number; secondAttempt?: number | null; bestAttempt?: number; numAttempts?: number; completed?: boolean }

const CUSTOM_MOL_FILE_MAP: Record<string, string> = {
  norwegianCities: "norwegianCities.json", norwegianMountains: "norwegianMountains.json", celebAge: "celebAge.json", kommuneInnbygger: "kommuneInnbygger.json", kommuneSize: "largestKommune.json", tvSeriesEpisodeCount: "tvSeriesEpisodeCount.json", medalsByCountry: "medalsByCountry.json", footballAllTimeGoalsTop25: "footballers-by-goals.json", worldPopulationTop40: "countries-by-population.json", elementsAtomicNumber: "atom-number.json", languagesBySpeakersTop50: "language-by-speakers.json", animalsTopSpeedTop30: "animal-by-topspeed.json", companiesFoundedYear: "companies-by-founding-date.json", norwegianTvSeriesPremiere: "norwegian-TV-by-launch.json", mostVisitedTouristAttractions: "tourist-destionations-by-visitors.json", moviesByRuntime: "movies-by-runtime.json", tvSeriesBySeasons: "tv-series-by-seasons.json", top30TaylorSwiftSongs: "top30-taylor-swift-songs.json", top30NorwegianArtistsInternationally: "top30-norwegian-artists-internationally.json", mostKnownWineDistricts: "most-known-wine-districts.json", countriesMostBillboard1Hits: "countries-most-billboard-1-hits.json", legoSetsByPieces: "lego-sets-by-pieces.json", cryptocurrenciesByWorth: "cryptocurrencies-by-worth.json", citiesByAverageRent: "cities-by-average-rent.json", countriesByPassportStrength: "countries-by-passport-strength.json", citiesByPollutionIndex: "cities-by-pollution-index.json", bordersByLength: "borders-by-length.json",
}

async function loadCustomGame(slug: string) {
  const file = CUSTOM_MOL_FILE_MAP[slug]
  if (!file) return null
  const localCandidates = [path.resolve(process.cwd(), "data/more-or-less/custom-games", file), path.resolve(process.cwd(), "../res/games/moreOrLess/customGames", file)]
  const local = localCandidates.find((candidate) => fs.existsSync(candidate))
  let raw: any
  if (local) raw = JSON.parse(fs.readFileSync(local, "utf8"))
  else { const response = await fetch(`https://raw.githubusercontent.com/arnekva/Mazarini/master/res/games/moreOrLess/customGames/${file}`); if (!response.ok) return null; raw = await response.json() }
  const game = raw?.game ?? raw
  const items = (game?.data ?? []).filter((item: unknown) => Array.isArray(item) && item.length <= 4).map((item: [string, number, string]) => ({ subject: item[0], answer: item[1], image: item[2] ?? "" }))
  return { items, strings: game?.strings }
}

function apiItems(items: unknown[]): MolItem[] { return items.filter((item): item is [string, number, string] => Array.isArray(item) && item.length <= 4).map((item) => ({ subject: item[0], answer: item[1], image: item[2] ?? "" })) }
function shuffle<T>(items: T[]): T[] { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] } return copy }
function calcTierReward(from: number, to: number) { const r = moreOrLessValues.rewards; let total = 0; for (let i = from + 1; i <= to; i++) total += i <= 10 ? r.tier1 : i <= 20 ? r.tier2 : i <= 30 ? r.tier3 : i <= 40 ? r.tier4 : i <= 50 ? r.tier5 : r.tier6; return total }

export async function getMoreOrLessStatus(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper(); const [dbUser, storage] = await Promise.all([firebase.getUser(user.id), firebase.getData("other")]); const category = storage?.moreOrLess?.current as MolCategory | undefined
  if (!category) return Response.json({ error: "Ingen kategori satt ennå" }, { status: 503 })
  let session = dbUser?.moreOrLessSession as MolSession | undefined
  if (session && session.slug !== category.slug) { await firebase.updateUserFields(user.id, { moreOrLessSession: null }); session = undefined }
  return Response.json({ category: { title: category.title, description: category.description, image: category.image, strings: category.strings, totalEntries: category.totalEntries }, unsupported: false, stats: dbUser?.dailyGameStats?.moreOrLess ?? {}, hasActiveSession: !!session, active: session ? { current: session.current, next: { subject: session.next.subject, image: session.next.image }, correctAnswers: session.correctAnswers } : undefined })
}

export async function startMoreOrLessGame(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper(); const storage = await firebase.getData("other"); const category = storage?.moreOrLess?.current as MolCategory | undefined
  if (!category) return Response.json({ error: "Ingen kategori satt ennå" }, { status: 503 })
  let items: MolItem[]; let strings = category.strings
  if (category.tags?.includes(CUSTOM_MOL_GAME_TAG)) { const custom = await loadCustomGame(category.slug); if (!custom) return Response.json({ error: "Klarte ikke å laste denne kategorien i appen" }, { status: 400 }); items = custom.items; strings = custom.strings }
  else { const response = await fetch(`https://api.moreorless.io/en/games/${category.slug}.json`); if (!response.ok) return Response.json({ error: "Klarte ikke å hente kategori-data" }, { status: 502 }); const body = await response.json(); items = apiItems(body.game?.data ?? []); strings = body.game?.strings ?? strings }
  if (items.length < 2) return Response.json({ error: "For få elementer i kategorien" }, { status: 502 })
  const shuffled = shuffle(items); const current = shuffled.pop()!; const next = shuffled.pop()!; await firebase.updateUserFields(user.id, { moreOrLessSession: { slug: category.slug, data: shuffled, current, next, correctAnswers: 0 } })
  return Response.json({ current, next: { subject: next.subject, image: next.image }, correctAnswers: 0, totalEntries: items.length, strings })
}

export async function guessMoreOrLess(user: AuthenticatedDiscordUser, more: boolean) {
  const firebase = new FirebaseHelper(); const [dbUser, storage] = await Promise.all([firebase.getUser(user.id), firebase.getData("other")]); const session = dbUser?.moreOrLessSession as MolSession | undefined; const category = storage?.moreOrLess?.current as MolCategory | undefined
  if (!session) return Response.json({ error: "Ingen aktiv runde - start en ny" }, { status: 400 })
  if (!category || session.slug !== category.slug) { await firebase.updateUserFields(user.id, { moreOrLessSession: null }); return Response.json({ error: "Ingen aktiv runde - start en ny" }, { status: 400 }) }

  const correct = (more && session.next.answer >= session.current.answer) || (!more && session.next.answer <= session.current.answer)
  const correctAnswers = correct ? session.correctAnswers + 1 : session.correctAnswers
  const completedNow = correct && session.data.length === 0

  if (correct && !completedNow) {
    const remaining = [...session.data]; const newNext = remaining.pop()!; const newSession = { ...session, current: session.next, next: newNext, data: remaining, correctAnswers }
    await firebase.updateUserFields(user.id, { moreOrLessSession: newSession })
    const bestAttempt = typeof dbUser?.dailyGameStats?.moreOrLess?.bestAttempt === "number" ? dbUser.dailyGameStats.moreOrLess.bestAttempt : 0
    return Response.json({ correct: true, finished: false, current: { subject: newSession.current.subject, answer: newSession.current.answer, image: newSession.current.image }, next: { subject: newNext.subject, image: newNext.image }, correctAnswers, bestAttempt, liveReward: correctAnswers > bestAttempt ? calcTierReward(bestAttempt, correctAnswers) : 0 })
  }

  // Final correct guesses must not read or serialize a nonexistent next item. Normalize all values
  // before writing because Firebase rejects undefined values (which can exist in older user stats).
  const stat = (dbUser?.dailyGameStats?.moreOrLess ?? {}) as MolStat
  const oldBest = typeof stat.bestAttempt === "number" ? stat.bestAttempt : 0
  const numAttempts = typeof stat.numAttempts === "number" ? stat.numAttempts + 1 : 1
  const firstAttempt = typeof stat.firstAttempt === "number" ? stat.firstAttempt : correctAnswers
  const secondAttempt = stat.secondAttempt == null ? null : (typeof stat.secondAttempt === "number" ? stat.secondAttempt : null)
  const completedPreviously = stat.completed === true
  const completed = completedPreviously || completedNow
  const newBest = Math.max(oldBest, correctAnswers)
  const reward = correctAnswers > oldBest ? calcTierReward(oldBest, correctAnswers) + (completedNow && !completedPreviously ? moreOrLessValues.rewards.completed : 0) : (completedNow && !completedPreviously ? moreOrLessValues.rewards.completed : 0)
  const chips = (typeof dbUser?.chips === "number" ? dbUser.chips : 0) + reward
  const newStat: MolStat = { attempted: true, firstAttempt, secondAttempt, bestAttempt: newBest, numAttempts, completed }
  await firebase.updateUserFields(user.id, { ...(reward > 0 ? { chips } : {}), "dailyGameStats/moreOrLess": newStat, moreOrLessSession: null })
  return Response.json({ correct, finished: true, completedNow, correctAnswers, reward, chips, bestAttempt: newBest, numAttempts })
}
