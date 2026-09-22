import fs from "fs"
import path from "path"
import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { CUSTOM_MOL_GAME_TAG, moreOrLessValues } from "./gameValues"

interface MolItem {
  subject: string
  answer: number
  image: string
}

interface MolCategory {
  slug: string
  title: string
  description: string
  image: string
  tags?: string[]
  totalEntries?: number
  strings?: { verb: string; valueTitle: string; valueSuffix?: string; buttonMore?: string; buttonLess?: string }
}

interface MolSession {
  slug: string
  data: MolItem[]
  current: MolItem
  next: MolItem
  correctAnswers: number
}

interface MolStat {
  attempted?: boolean
  firstAttempt?: number
  secondAttempt?: number | null
  bestAttempt?: number
  numAttempts?: number
  completed?: boolean
}

function findCustomMoreOrLessGameFile(slug: string) {
  const candidates = [
    path.resolve(process.cwd(), "../res/games/moreOrLess/customGames", `${slug}.json`),
    path.resolve(process.cwd(), "res/games/moreOrLess/customGames", `${slug}.json`),
    path.resolve(process.cwd(), "../..", "res/games/moreOrLess/customGames", `${slug}.json`),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate))
}

function loadCustomMoreOrLessGame(slug: string) {
  const gameFile = findCustomMoreOrLessGameFile(slug)
  if (!gameFile) return null

  const raw = JSON.parse(fs.readFileSync(gameFile, "utf-8"))
  const gameData = raw?.game ?? raw
  const items: MolItem[] = (gameData?.data ?? [])
    .filter((item: unknown) => Array.isArray(item) && item.length <= 4)
    .map((item: [string, number, string]) => ({ subject: item[0], answer: item[1], image: item[2] ?? "" }))

  const strings = gameData?.strings ?? {
    verb: "har",
    valueTitle: "",
    buttonMore: "Mer",
    buttonLess: "Mindre",
  }

  return { items, strings }
}

function toMolItems(items: unknown[]): MolItem[] {
  return items
    .filter((item): item is [string, number, string] => Array.isArray(item) && item.length <= 4)
    .map((item) => ({ subject: item[0], answer: item[1], image: item[2] ?? "" }))
}

/** Chips earned for correct answers strictly after `fromExclusive` up to `toInclusive` - used both
 * for the live "how much have I earned so far this round" counter and the final round-over payout. */
function calcTierReward(fromExclusive: number, toInclusive: number): number {
  const rewards = moreOrLessValues.rewards
  let reward = 0
  for (let i = fromExclusive + 1; i <= toInclusive; i++) {
    if (i <= 10) reward += rewards.tier1
    else if (i <= 20) reward += rewards.tier2
    else if (i <= 30) reward += rewards.tier3
    else if (i <= 40) reward += rewards.tier4
    else if (i <= 50) reward += rewards.tier5
    else reward += rewards.tier6
  }
  return reward
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export async function getMoreOrLessStatus(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const [dbUser, storage] = await Promise.all([firebase.getUser(user.id), firebase.getData("other")])
  const category: MolCategory | undefined = storage?.moreOrLess?.current
  if (!category) return Response.json({ error: "Ingen kategori satt ennå" }, { status: 503 })

  let session: MolSession | undefined = dbUser?.moreOrLessSession
  if (session && session.slug !== category.slug) {
    // Leftover session from a category the daily reset has since rolled past - drop it rather
    // than resuming play against yesterday's data under today's title.
    await firebase.updateUserFields(user.id, { moreOrLessSession: null })
    session = undefined
  }
  return Response.json({
    category: { title: category.title, description: category.description, image: category.image, strings: category.strings, totalEntries: category.totalEntries },
    unsupported: false,
    stats: dbUser?.dailyGameStats?.moreOrLess ?? {},
    hasActiveSession: !!session,
    active: session ? { current: { subject: session.current.subject, answer: session.current.answer, image: session.current.image }, next: { subject: session.next.subject, image: session.next.image } } : undefined,
  })
}

export async function startMoreOrLessGame(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const storage = await firebase.getData("other")
  const category: MolCategory | undefined = storage?.moreOrLess?.current
  if (!category) return Response.json({ error: "Ingen kategori satt ennå" }, { status: 503 })

  let items: MolItem[] = []
  let strings = category.strings

  if (category.tags?.includes(CUSTOM_MOL_GAME_TAG)) {
    const customGame = loadCustomMoreOrLessGame(category.slug)
    if (!customGame) return Response.json({ error: "Klarte ikke å laste denne kategorien i appen" }, { status: 400 })
    items = customGame.items
    strings = customGame.strings as MolCategory["strings"]
  } else {
    const response = await fetch(`https://api.moreorless.io/en/games/${category.slug}.json`, { headers: { Accept: "application/json" } })
    if (!response.ok) return Response.json({ error: "Klarte ikke å hente kategori-data" }, { status: 502 })
    const body = await response.json()
    items = toMolItems(body.game?.data ?? [])
    strings = body.game?.strings ?? strings
  }

  if (items.length < 2) return Response.json({ error: "For få elementer i kategorien" }, { status: 502 })

  const shuffled = shuffle(items)
  const current = shuffled.pop()!
  const next = shuffled.pop()!
  const session: MolSession = { slug: category.slug, data: shuffled, current, next, correctAnswers: 0 }

  await firebase.updateUserFields(user.id, { moreOrLessSession: session })

  return Response.json({
    current: { subject: current.subject, answer: current.answer, image: current.image },
    next: { subject: next.subject, image: next.image },
    correctAnswers: 0,
    totalEntries: items.length,
    strings,
  })
}

export async function guessMoreOrLess(user: AuthenticatedDiscordUser, more: boolean) {
  const firebase = new FirebaseHelper()
  const [dbUser, storage] = await Promise.all([firebase.getUser(user.id), firebase.getData("other")])
  const session: MolSession | undefined = dbUser?.moreOrLessSession
  if (!session) return Response.json({ error: "Ingen aktiv runde - start en ny" }, { status: 400 })

  const category: MolCategory | undefined = storage?.moreOrLess?.current
  if (!category || session.slug !== category.slug) {
    // Session belongs to a category the daily reset has since rolled past.
    await firebase.updateUserFields(user.id, { moreOrLessSession: null })
    return Response.json({ error: "Ingen aktiv runde - start en ny" }, { status: 400 })
  }

  const correct = (more && session.next.answer >= session.current.answer) || (!more && session.next.answer <= session.current.answer)
  const correctAnswers = correct ? session.correctAnswers + 1 : session.correctAnswers

  if (correct && session.data.length > 0) {
    const remaining = [...session.data]
    const newNext = remaining.pop()!
    const newSession: MolSession = { ...session, current: session.next, next: newNext, data: remaining, correctAnswers }
    await firebase.updateUserFields(user.id, { moreOrLessSession: newSession })

    // Live "how much would I earn if I stopped right now" - lets the client show a running
    // (+N chips) counter once you've passed your best, instead of only at round-end.
    const bestAttempt = dbUser?.dailyGameStats?.moreOrLess?.bestAttempt ?? 0
    const liveReward = correctAnswers > bestAttempt ? calcTierReward(bestAttempt, correctAnswers) : 0

    return Response.json({
      correct: true,
      finished: false,
      current: { subject: newSession.current.subject, answer: newSession.current.answer, image: newSession.current.image },
      next: { subject: newNext.subject, image: newNext.image },
      correctAnswers,
      bestAttempt,
      liveReward,
    })
  }

  // Round over - mirrors commands/games/moreOrLess.ts's endGame in the bot repo.
  const completedNow = session.data.length === 0 && correct
  const stat: MolStat = dbUser?.dailyGameStats?.moreOrLess ?? {}
  const wasAttemptedBefore = !!stat.attempted
  const numTries = (stat.numAttempts ?? 0) + 1
  const secondAttempt = wasAttemptedBefore && stat.firstAttempt !== undefined && stat.secondAttempt == null && numTries > 1 ? correctAnswers : (stat.secondAttempt ?? null)
  const firstAttempt = wasAttemptedBefore ? stat.firstAttempt : correctAnswers
  const bestAttempt = stat.bestAttempt ?? 0
  const completedPreviously = !!stat.completed

  let reward = 0
  let chips = dbUser.chips ?? 0
  let newBest = bestAttempt
  let completed = completedPreviously

  if (correctAnswers > bestAttempt) {
    reward = calcTierReward(bestAttempt, correctAnswers)
    if (completedNow && !completedPreviously) reward += moreOrLessValues.rewards.completed
    newBest = correctAnswers
    if (session.data.length === 0) completed = true
    chips += reward
  }

  const newStat: MolStat = { attempted: true, firstAttempt, secondAttempt, bestAttempt: newBest, numAttempts: numTries, completed }

  await firebase.updateUserFields(user.id, {
    ...(reward > 0 ? { chips } : {}),
    "dailyGameStats/moreOrLess": newStat,
    moreOrLessSession: null,
  })

  return Response.json({
    correct,
    finished: true,
    completedNow,
    correctAnswers,
    reward,
    chips,
    bestAttempt: newBest,
    numAttempts: numTries,
    revealedNext: { subject: session.next.subject, answer: session.next.answer, image: session.next.image },
  })
}
