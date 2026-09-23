import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { postChannelMessage } from "./discordMessage"
import { ANNOUNCE_CHANNEL_ID, CUSTOM_MOL_GAME_TAG, moreOrLessValues } from "./gameValues"

import cg_norwegianCities from "@/data/more-or-less/norwegianCities.json"
import cg_norwegianMountains from "@/data/more-or-less/norwegianMountains.json"
import cg_celebAge from "@/data/more-or-less/celebAge.json"
import cg_kommuneInnbygger from "@/data/more-or-less/kommuneInnbygger.json"
import cg_kommuneSize from "@/data/more-or-less/largestKommune.json"
import cg_tvSeriesEpisodeCount from "@/data/more-or-less/tvSeriesEpisodeCount.json"
import cg_medalsByCountry from "@/data/more-or-less/medalsByCountry.json"
import cg_footballAllTimeGoalsTop25 from "@/data/more-or-less/footballers-by-goals.json"
import cg_worldPopulationTop40 from "@/data/more-or-less/countries-by-population.json"
import cg_elementsAtomicNumber from "@/data/more-or-less/atom-number.json"
import cg_languagesBySpeakersTop50 from "@/data/more-or-less/language-by-speakers.json"
import cg_animalsTopSpeedTop30 from "@/data/more-or-less/animal-by-topspeed.json"
import cg_companiesFoundedYear from "@/data/more-or-less/companies-by-founding-date.json"
import cg_norwegianTvSeriesPremiere from "@/data/more-or-less/norwegian-TV-by-launch.json"
import cg_mostVisitedTouristAttractions from "@/data/more-or-less/tourist-destionations-by-visitors.json"
import cg_moviesByRuntime from "@/data/more-or-less/movies-by-runtime.json"
import cg_tvSeriesBySeasons from "@/data/more-or-less/tv-series-by-seasons.json"
import cg_top30TaylorSwiftSongs from "@/data/more-or-less/top30-taylor-swift-songs.json"
import cg_top30NorwegianArtistsInternationally from "@/data/more-or-less/top30-norwegian-artists-internationally.json"
import cg_mostKnownWineDistricts from "@/data/more-or-less/most-known-wine-districts.json"
import cg_countriesMostBillboard1Hits from "@/data/more-or-less/countries-most-billboard-1-hits.json"
import cg_legoSetsByPieces from "@/data/more-or-less/lego-sets-by-pieces.json"
import cg_cryptocurrenciesByWorth from "@/data/more-or-less/cryptocurrencies-by-worth.json"
import cg_citiesByAverageRent from "@/data/more-or-less/cities-by-average-rent.json"
import cg_countriesByPassportStrength from "@/data/more-or-less/countries-by-passport-strength.json"
import cg_citiesByPollutionIndex from "@/data/more-or-less/cities-by-pollution-index.json"
import cg_bordersByLength from "@/data/more-or-less/borders-by-length.json"
import cg_imdbRatingsNorwegian from "@/data/more-or-less/imdb-ratings-norwegian.json"
import cg_usStatesByPopulation from "@/data/more-or-less/us-states-by-population.json"

interface MolItem {
  subject: string
  answer: number
  image: string
}
interface MolStrings {
  verb: string
  valueTitle: string
  valueSuffix?: string
  buttonMore?: string
  buttonLess?: string
}
interface MolCategory {
  slug: string
  title: string
  description: string
  image: string
  tags?: string[]
  totalEntries?: number
  strings?: MolStrings
}
// Firebase RTDB removes empty arrays. A completed deck is therefore persisted as null.
interface MolSession {
  slug: string
  data?: MolItem[] | null
  current?: MolItem
  next?: MolItem
  correctAnswers?: number
}
interface MolStat {
  attempted?: boolean
  firstAttempt?: number
  secondAttempt?: number | null
  bestAttempt?: number
  numAttempts?: number
  completed?: boolean
}

// Own copy of the bot repo's res/games/moreOrLess/customGames/*.json, statically imported so Vercel's
// bundler actually includes them in the deploy - a runtime fs.readFileSync/relative-path lookup into
// the bot's `res/` folder never worked here (that folder isn't part of this deploy), and the previous
// GitHub-raw-fetch fallback added a network dependency + latency for every single game start.
// Same "kept in sync by hand" relationship as gameValues.ts mirroring the bot repo's general/values.ts -
// the bot's own /moreorless command still reads its res/ copy directly (CustomMOLHandler.getJSONByName),
// so that copy stays in place; this is a deliberate duplicate, not dead weight to delete.
const CUSTOM_GAME_DATA: Record<string, unknown> = {
  norwegianCities: cg_norwegianCities,
  norwegianMountains: cg_norwegianMountains,
  celebAge: cg_celebAge,
  kommuneInnbygger: cg_kommuneInnbygger,
  kommuneSize: cg_kommuneSize,
  tvSeriesEpisodeCount: cg_tvSeriesEpisodeCount,
  medalsByCountry: cg_medalsByCountry,
  footballAllTimeGoalsTop25: cg_footballAllTimeGoalsTop25,
  worldPopulationTop40: cg_worldPopulationTop40,
  elementsAtomicNumber: cg_elementsAtomicNumber,
  languagesBySpeakersTop50: cg_languagesBySpeakersTop50,
  animalsTopSpeedTop30: cg_animalsTopSpeedTop30,
  companiesFoundedYear: cg_companiesFoundedYear,
  norwegianTvSeriesPremiere: cg_norwegianTvSeriesPremiere,
  mostVisitedTouristAttractions: cg_mostVisitedTouristAttractions,
  moviesByRuntime: cg_moviesByRuntime,
  tvSeriesBySeasons: cg_tvSeriesBySeasons,
  top30TaylorSwiftSongs: cg_top30TaylorSwiftSongs,
  top30NorwegianArtistsInternationally: cg_top30NorwegianArtistsInternationally,
  mostKnownWineDistricts: cg_mostKnownWineDistricts,
  countriesMostBillboard1Hits: cg_countriesMostBillboard1Hits,
  legoSetsByPieces: cg_legoSetsByPieces,
  cryptocurrenciesByWorth: cg_cryptocurrenciesByWorth,
  citiesByAverageRent: cg_citiesByAverageRent,
  countriesByPassportStrength: cg_countriesByPassportStrength,
  citiesByPollutionIndex: cg_citiesByPollutionIndex,
  bordersByLength: cg_bordersByLength,
  imdbRatingsNorwegian: cg_imdbRatingsNorwegian,
  usStatesByPopulation: cg_usStatesByPopulation,
}

function loadCustom(slug: string): { items: MolItem[]; strings?: MolStrings } | null {
  const raw = CUSTOM_GAME_DATA[slug] as { game?: { data?: unknown[]; strings?: MolStrings } } | undefined
  if (!raw) return null
  const game = raw.game ?? (raw as unknown as { data?: unknown[]; strings?: MolStrings })
  const items: MolItem[] = Array.isArray(game?.data)
    ? game.data
        .filter((x): x is [string, number, string?] => Array.isArray(x) && x.length <= 4)
        .map((x) => ({ subject: x[0], answer: x[1], image: x[2] ?? "" }))
    : []
  return { items, strings: game?.strings }
}

function apiItems(data: unknown[]): MolItem[] {
  return data
    .filter((x): x is [string, number, string?] => Array.isArray(x) && x.length <= 4)
    .map((x) => ({ subject: x[0], answer: x[1], image: x[2] ?? "" }))
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function tierReward(from: number, to: number) {
  const r = moreOrLessValues.rewards
  let total = 0
  for (let i = from + 1; i <= to; i++) {
    total += i <= 10 ? r.tier1 : i <= 20 ? r.tier2 : i <= 30 ? r.tier3 : i <= 40 ? r.tier4 : i <= 50 ? r.tier5 : r.tier6
  }
  return total
}

export async function getMoreOrLessStatus(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const [dbUser, storage] = await Promise.all([firebase.getUser(user.id), firebase.getData("other")])
  const category = storage?.moreOrLess?.current as MolCategory | undefined
  if (!category) return Response.json({ error: "Ingen kategori satt ennå" }, { status: 503 })

  let session = dbUser?.moreOrLessSession as MolSession | undefined
  if (session && session.slug !== category.slug) {
    // Leftover session from a category the daily reset has since rolled past.
    await firebase.updateUserFields(user.id, { moreOrLessSession: null })
    session = undefined
  }

  return Response.json({
    category: { title: category.title, description: category.description, image: category.image, strings: category.strings, totalEntries: category.totalEntries },
    unsupported: false,
    stats: dbUser?.dailyGameStats?.moreOrLess ?? {},
    hasActiveSession: !!session,
    active:
      session?.current && session?.next
        ? { current: session.current, next: { subject: session.next.subject, image: session.next.image }, correctAnswers: session.correctAnswers ?? 0 }
        : undefined,
  })
}

export async function startMoreOrLessGame(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const storage = await firebase.getData("other")
  const category = storage?.moreOrLess?.current as MolCategory | undefined
  if (!category) return Response.json({ error: "Ingen kategori satt ennå" }, { status: 503 })

  let items: MolItem[]
  let strings = category.strings
  if (category.tags?.includes(CUSTOM_MOL_GAME_TAG)) {
    const custom = loadCustom(category.slug)
    if (!custom) return Response.json({ error: "Klarte ikke å laste denne kategorien i appen" }, { status: 400 })
    items = custom.items
    strings = custom.strings ?? strings
  } else {
    const response = await fetch(`https://api.moreorless.io/en/games/${category.slug}.json`, { headers: { Accept: "application/json" } })
    if (!response.ok) return Response.json({ error: "Klarte ikke å hente kategori-data" }, { status: 502 })
    const body = await response.json()
    items = apiItems(body.game?.data ?? [])
    strings = body.game?.strings ?? strings
  }
  if (items.length < 2) return Response.json({ error: "For få elementer i kategorien" }, { status: 502 })

  const shuffled = shuffle(items)
  const current = shuffled.pop()!
  const next = shuffled.pop()!
  const session: MolSession = { slug: category.slug, data: shuffled, current, next, correctAnswers: 0 }
  await firebase.updateUserFields(user.id, { moreOrLessSession: session })

  return Response.json({ current, next: { subject: next.subject, image: next.image }, correctAnswers: 0, totalEntries: items.length, strings })
}

export async function guessMoreOrLess(user: AuthenticatedDiscordUser, more: boolean) {
  const firebase = new FirebaseHelper()
  const [dbUser, storage] = await Promise.all([firebase.getUser(user.id), firebase.getData("other")])
  const session = dbUser?.moreOrLessSession as MolSession | undefined
  const category = storage?.moreOrLess?.current as MolCategory | undefined
  if (!session) return Response.json({ error: "Ingen aktiv runde - start en ny" }, { status: 400 })
  // Do not require data to be an array: RTDB drops [] when the penultimate guess is saved.
  if (!category || session.slug !== category.slug || !session.current || !session.next) {
    await firebase.updateUserFields(user.id, { moreOrLessSession: null })
    return Response.json({ error: "Ugyldig spillrunde - start en ny" }, { status: 400 })
  }

  const remainingItems = Array.isArray(session.data) ? session.data : []
  const correct = (more && session.next.answer >= session.current.answer) || (!more && session.next.answer <= session.current.answer)
  const correctAnswers = correct ? (session.correctAnswers ?? 0) + 1 : (session.correctAnswers ?? 0)
  const completedNow = correct && remainingItems.length === 0

  if (correct && !completedNow) {
    const remaining = [...remainingItems]
    const newNext = remaining.pop()
    if (!newNext) return Response.json({ error: "Ugyldig spillrunde - start en ny" }, { status: 400 })
    // Explicitly persist null instead of [] because Firebase removes empty arrays.
    const newSession = { ...session, current: session.next, next: newNext, data: remaining.length > 0 ? remaining : null, correctAnswers }
    await firebase.updateUserFields(user.id, { moreOrLessSession: newSession })
    const best = typeof dbUser?.dailyGameStats?.moreOrLess?.bestAttempt === "number" ? dbUser.dailyGameStats.moreOrLess.bestAttempt : 0
    return Response.json({
      correct: true,
      finished: false,
      current: { subject: newSession.current.subject, answer: newSession.current.answer, image: newSession.current.image },
      next: { subject: newNext.subject, image: newNext.image },
      correctAnswers,
      bestAttempt: best,
      liveReward: correctAnswers > best ? tierReward(best, correctAnswers) : 0,
    })
  }

  const stat = (dbUser?.dailyGameStats?.moreOrLess ?? {}) as MolStat
  const oldBest = typeof stat.bestAttempt === "number" ? stat.bestAttempt : 0
  const attempts = typeof stat.numAttempts === "number" ? stat.numAttempts + 1 : 1
  // The daily reset job writes { attempted: false, firstAttempt: 0, secondAttempt: null, ... } for everyone, so
  // firstAttempt being a number says nothing about whether they've played - `attempted` is the real signal
  // (same as commands/games/moreOrLess.ts's endGame). Keying off firstAttempt made every first attempt stick at 0.
  const alreadyPlayed = stat.attempted === true
  const firstAttempt = alreadyPlayed && typeof stat.firstAttempt === "number" ? stat.firstAttempt : correctAnswers
  // The *second* play of the day is captured once; any later play leaves both first and second alone.
  const secondAttempt = alreadyPlayed && typeof stat.secondAttempt === "number" ? stat.secondAttempt : alreadyPlayed ? correctAnswers : null
  const completedPreviously = stat.completed === true
  const newBest = Math.max(oldBest, correctAnswers)
  const reward = correctAnswers > oldBest ? tierReward(oldBest, correctAnswers) + (completedNow && !completedPreviously ? moreOrLessValues.rewards.completed : 0) : 0
  const chips = (typeof dbUser?.chips === "number" ? dbUser.chips : 0) + reward
  const newStat: MolStat = { attempted: true, firstAttempt, secondAttempt, bestAttempt: newBest, numAttempts: attempts, completed: completedPreviously || completedNow }
  if (reward > 0) await firebase.updateUserFields(user.id, { chips })
  await firebase.updateUserFields(user.id, { "dailyGameStats/moreOrLess": newStat, moreOrLessSession: null })

  if (completedNow && !completedPreviously) {
    await postChannelMessage(ANNOUNCE_CHANNEL_ID, {
      content: `<@${user.id}> fullførte dagens More or Less (${category.title}) med ${correctAnswers} riktige og fikk ${reward} chips!`,
    })
  }

  return Response.json({
    correct,
    finished: true,
    completedNow,
    correctAnswers,
    reward,
    chips,
    bestAttempt: newBest,
    numAttempts: attempts,
    // The item the player guessed wrong on (or the final one, if they just completed the category) -
    // the client never learned its value mid-round, so it needs revealing here.
    revealedNext: { subject: session.next.subject, answer: session.next.answer, image: session.next.image },
  })
}
