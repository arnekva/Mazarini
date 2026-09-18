import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { DailyGameStats, hasRewardedSlotsLeft } from "./dailyHub"
import { postChannelMessage } from "./discordMessage"
import { ANNOUNCE_CHANNEL_ID, mastermindValues } from "./gameValues"

interface Guess {
  guess: string[]
  black: number
  white: number
}

interface MastermindStat {
  attempted?: boolean
  completed?: boolean
  numAttempts?: number
  guesses?: Guess[]
}

// Mirrors commands/games/mastermind.ts's checkGuess in the bot repo.
function checkGuess(guess: string[], solution: string[]): { black: number; white: number } {
  let black = 0
  let white = 0
  const answerCopy = [...solution]
  const guessCopy = [...guess]

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === solution[i]) {
      black++
      answerCopy[i] = guessCopy[i] = null as any
    }
  }
  for (let i = 0; i < guess.length; i++) {
    if (guessCopy[i] && answerCopy.includes(guessCopy[i])) {
      white++
      answerCopy[answerCopy.indexOf(guessCopy[i])] = null as any
    }
  }
  return { black, white }
}

function isValidGuess(guess: unknown): guess is string[] {
  return (
    Array.isArray(guess) &&
    guess.length === mastermindValues.codeLength &&
    guess.every((c) => typeof c === "string" && (mastermindValues.colors as readonly string[]).includes(c))
  )
}

export async function getMastermindStatus(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const dbUser = await firebase.getUser(user.id)
  const stat: MastermindStat = dbUser?.dailyGameStats?.mastermind ?? {}

  return Response.json({
    guesses: stat.guesses ?? [],
    completed: !!stat.completed,
    numAttempts: stat.numAttempts ?? 0,
    maxAttempts: mastermindValues.totalAttempts,
    codeLength: mastermindValues.codeLength,
    colors: mastermindValues.colors,
  })
}

export async function submitMastermindGuess(user: AuthenticatedDiscordUser, guess: unknown) {
  if (!isValidGuess(guess)) return Response.json({ error: "Invalid guess" }, { status: 400 })

  const firebase = new FirebaseHelper()
  const [dbUser, storage] = await Promise.all([firebase.getUser(user.id), firebase.getData("other")])
  const solution: string[] | undefined = storage?.mastermind
  if (!solution || solution.length !== mastermindValues.codeLength) {
    return Response.json({ error: "Ingen mastermind-løsning generert ennå" }, { status: 503 })
  }

  const dailyGameStats: DailyGameStats = dbUser?.dailyGameStats ?? {}
  const stat: MastermindStat = dailyGameStats.mastermind ?? {}
  if (stat.completed) return Response.json({ alreadyCompleted: true })
  if ((stat.numAttempts ?? 0) >= mastermindValues.totalAttempts) {
    return Response.json({ noAttemptsLeft: true, solution })
  }

  const hint = checkGuess(guess, solution)
  const numAttempts = (stat.numAttempts ?? 0) + 1
  const guesses = [...(stat.guesses ?? []), { guess, black: hint.black, white: hint.white }]
  const completed = hint.black === mastermindValues.codeLength
  const finished = completed || numAttempts >= mastermindValues.totalAttempts

  let reward = 0
  let chips = dbUser.chips ?? 0
  if (completed) {
    reward = hasRewardedSlotsLeft(dailyGameStats) ? Math.max(0, mastermindValues.baseReward - mastermindValues.perGuessPenalty * numAttempts) : 0
    chips += reward
  }

  await firebase.updateUserFields(user.id, {
    ...(completed ? { chips } : {}),
    "dailyGameStats/mastermind": { attempted: true, completed, numAttempts, guesses },
  })

  if (completed) {
    await postChannelMessage(ANNOUNCE_CHANNEL_ID, {
      content: `<@${user.id}> klarte mastermind på ${numAttempts}/${mastermindValues.totalAttempts} forsøk${reward > 0 ? ` og fikk ${reward} chips!` : "!"}`,
    })
  } else if (finished) {
    await postChannelMessage(ANNOUNCE_CHANNEL_ID, {
      content: `<@${user.id}> klarte IKKE mastermind på ${mastermindValues.totalAttempts} forsøk!`,
    })
  }

  return Response.json({
    black: hint.black,
    white: hint.white,
    numAttempts,
    completed,
    reward,
    chips,
    solution: finished && !completed ? solution : undefined,
  })
}
