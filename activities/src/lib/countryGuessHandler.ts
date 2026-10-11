import { increment } from "firebase/database"
import { after } from "next/server"
import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { challengeItems, CountryChallenge, DailyGameStats, GameStat, hasRewardedSlotsLeft, publicChallenge } from "./dailyHub"
import { announceInChannel, KEKW_EMOJI } from "./discordMessage"
import { getGuessHint } from "./geo"
import { countryChallengeValues } from "./gameValues"

export type CountryGameId = "flag" | "outline" | "capital"

// What the announcement calls the items of each game ("svarte rett på 3/4 flagg").
const pluralLabels: Record<CountryGameId, string> = {
  flag: "flagg",
  outline: "outlines",
  capital: "hovedsteder",
}
// ...and the one item, when a game has just one ("gjettet rett på 2/3 forsøk på flagget").
const singleLabels: Record<CountryGameId, string> = {
  flag: "flagget",
  outline: "landet fra outline",
  capital: "hovedstaden",
}

export function isCountryGameId(value: string): value is CountryGameId {
  return value === "flag" || value === "outline" || value === "capital"
}

/** Where a player is in today's game: `index` items are settled (right, out of attempts or skipped), `correct` of them right. The game is
 * over once every item is settled. Saves from before the game had several items (just `completed` / `numAttempts`) are read as that one item. */
interface Progress {
  index: number
  correct: number
  itemAttempts: number
}

function progressOf(stat: GameStat | undefined, total: number): Progress {
  if (!stat) return { index: 0, correct: 0, itemAttempts: 0 }
  if (typeof stat.index === "number") return { index: stat.index, correct: stat.correct ?? 0, itemAttempts: stat.itemAttempts ?? 0 }
  if (stat.completed) return { index: total, correct: 1, itemAttempts: 0 }
  const used = stat.numAttempts ?? 0
  if (used >= countryChallengeValues.maxAttempts) return { index: total, correct: 0, itemAttempts: 0 }
  return { index: 0, correct: 0, itemAttempts: used }
}

/** What goes back to the client about where the game stands - and the next item to show, when there is one (never its answer). */
function view(items: CountryChallenge[], progress: Progress) {
  const total = items.length
  const finished = progress.index >= total
  return {
    index: progress.index,
    total,
    correctCount: progress.correct,
    finished,
    itemAttempts: progress.itemAttempts,
    maxAttempts: countryChallengeValues.maxAttempts,
    reward: total === 1 ? countryChallengeValues.singleItemReward : countryChallengeValues.rewardPerCorrect,
    challenge: publicChallenge(items[Math.min(progress.index, total - 1)]),
  }
}

export async function getCountryGameStatus(game: CountryGameId, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  // Just this game's puzzle and this player's progress - not the whole shared storage and the whole user record they sit in.
  const [stat, challenge]: [GameStat | undefined, CountryChallenge | undefined] = await Promise.all([
    firebase.getData(`users/${user.id}/dailyGameStats/${game}`),
    firebase.getData(`other/dailyHubChallenges/${game}`),
  ])
  if (!challenge) return Response.json({ error: "Ingen utfordring generert ennå" }, { status: 503 })

  const items = challengeItems(challenge)
  return Response.json(view(items, progressOf(stat, items.length)))
}

/** Settles the item being played - right, out of attempts, or skipped - and moves on. Pays out, saves, and announces once the last one is done. */
async function settleItem(
  game: CountryGameId,
  user: AuthenticatedDiscordUser,
  items: CountryChallenge[],
  stat: GameStat | undefined,
  progress: Progress,
  outcome: "correct" | "out" | "skipped",
  guessesMade: number,
  dailyGameStats: DailyGameStats
) {
  const firebase = new FirebaseHelper()
  const total = items.length
  const single = total === 1
  const correct = progress.correct + (outcome === "correct" ? 1 : 0)
  const next: Progress = { index: progress.index + 1, correct, itemAttempts: 0 }
  const finished = next.index >= total
  // One item: the old reward, and only while the day's rewarded slots last. Several: each right one pays, no limit.
  const reward = outcome !== "correct" ? 0 : single ? (hasRewardedSlotsLeft(dailyGameStats) ? countryChallengeValues.singleItemReward : 0) : countryChallengeValues.rewardPerCorrect
  const numAttempts = (stat?.numAttempts ?? 0) + guessesMade

  await firebase.updateUserFields(user.id, {
    // Added on the server rather than written as "what it was + reward": the balance may have changed since anyone last read it.
    ...(reward > 0 ? { chips: increment(reward) } : {}),
    [`dailyGameStats/${game}`]: {
      attempted: true,
      // A single item only counts as completed when it was solved (losses don't take a rewarded slot); with several, when they're all settled.
      completed: finished && (!single || correct > 0),
      numAttempts,
      index: next.index,
      correct: next.correct,
      itemAttempts: 0,
      total,
    },
  })

  if (finished) {
    // After the answer has gone out - the player shouldn't wait for Discord to hear how it went.
    after(() =>
      announceInChannel(user.channelId, {
        content: single
          ? correct > 0
            ? `<@${user.id}> gjettet rett på ${numAttempts}/${countryChallengeValues.maxAttempts} forsøk på ${singleLabels[game]}${reward > 0 ? ` og fikk ${reward} chips!` : "!"}`
            : `<@${user.id}> svarte FEIL på ${singleLabels[game]}! ${KEKW_EMOJI}`
          : correct === 0
            ? `<@${user.id}> svarte FEIL på alle ${total} ${pluralLabels[game]}! ${KEKW_EMOJI}`
            : `<@${user.id}> svarte rett på ${correct}/${total} ${pluralLabels[game]}${correct * countryChallengeValues.rewardPerCorrect > 0 ? ` og fikk ${correct * countryChallengeValues.rewardPerCorrect} chips!` : "!"}`,
      })
    )
  }

  return { next, reward, answer: items[progress.index].answer }
}

async function loadGame(game: CountryGameId, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const [dailyGameStats = {}, challenge]: [DailyGameStats, CountryChallenge | undefined] = await Promise.all([
    firebase.getData(`users/${user.id}/dailyGameStats`),
    firebase.getData(`other/dailyHubChallenges/${game}`),
  ])
  if (!challenge) return undefined
  const items = challengeItems(challenge)
  const stat = dailyGameStats[game]
  return { stat, items, dailyGameStats, progress: progressOf(stat, items.length) }
}

export async function submitCountryGuess(game: CountryGameId, user: AuthenticatedDiscordUser, guess: string) {
  const loaded = await loadGame(game, user)
  if (!loaded) return Response.json({ error: "Ingen utfordring generert ennå" }, { status: 503 })
  const { stat, items, progress, dailyGameStats } = loaded

  if (progress.index >= items.length) {
    // One item, not solved: it was used up - say so with the answer, as it always did.
    if (items.length === 1 && progress.correct === 0) return Response.json({ noAttemptsLeft: true, answer: items[0].answer, ...view(items, progress) })
    return Response.json({ alreadyCompleted: true, ...view(items, progress) })
  }

  const current = items[progress.index]
  const correct = guess.trim().toLowerCase() === current.answer.trim().toLowerCase()

  if (correct) {
    const settled = await settleItem(game, user, items, stat, progress, "correct", 1, dailyGameStats)
    return Response.json({ correct: true, itemDone: true, itemReward: settled.reward, ...view(items, settled.next) })
  }

  const itemAttempts = progress.itemAttempts + 1
  if (itemAttempts >= countryChallengeValues.maxAttempts) {
    // Out of attempts on this one - the answer is shown (no hint, it'd be redundant) and the next item comes up.
    const settled = await settleItem(game, user, items, stat, progress, "out", 1, dailyGameStats)
    return Response.json({ correct: false, itemDone: true, revealAnswer: settled.answer, ...view(items, settled.next) })
  }

  const firebase = new FirebaseHelper()
  const next: Progress = { ...progress, itemAttempts }
  await firebase.updateUserFields(user.id, {
    [`dailyGameStats/${game}`]: {
      attempted: true,
      completed: false,
      numAttempts: (stat?.numAttempts ?? 0) + 1,
      index: next.index,
      correct: next.correct,
      itemAttempts: next.itemAttempts,
      total: items.length,
    },
  })

  return Response.json({
    correct: false,
    itemDone: false,
    attemptsLeft: countryChallengeValues.maxAttempts - itemAttempts,
    hint: getGuessHint(game === "capital" ? "capital" : "country", guess, current.answer),
    ...view(items, next),
  })
}

/** "Hopp over": gives this item up without a guess - nothing earned, and the next one comes up. */
export async function skipCountryItem(game: CountryGameId, user: AuthenticatedDiscordUser) {
  const loaded = await loadGame(game, user)
  if (!loaded) return Response.json({ error: "Ingen utfordring generert ennå" }, { status: 503 })
  const { stat, items, progress, dailyGameStats } = loaded

  // A game with one item has no skip button - and nothing here for a request that makes one up.
  if (items.length === 1) return Response.json({ error: "Kan ikke hoppe over" }, { status: 400 })
  if (progress.index >= items.length) return Response.json({ alreadyCompleted: true, ...view(items, progress) })

  const settled = await settleItem(game, user, items, stat, progress, "skipped", 0, dailyGameStats)
  return Response.json({ correct: false, skipped: true, itemDone: true, revealAnswer: settled.answer, ...view(items, settled.next) })
}
