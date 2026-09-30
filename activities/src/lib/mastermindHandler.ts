import { increment } from "firebase/database"
import { after } from "next/server"
import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { DailyGameStats, hasRewardedSlotsLeft } from "./dailyHub"
import { announceInChannel } from "./discordMessage"
import { mastermindValues } from "./gameValues"

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
  const stat: MastermindStat = (await firebase.getData(`users/${user.id}/dailyGameStats/mastermind`)) ?? {}

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
  // Just the solution and this player's daily stats - not the whole shared storage and the whole user record they sit in.
  const [storedStats, solution]: [DailyGameStats | undefined, string[] | undefined] = await Promise.all([
    firebase.getData(`users/${user.id}/dailyGameStats`),
    firebase.getData("other/mastermind"),
  ])
  if (!solution || solution.length !== mastermindValues.codeLength) {
    return Response.json({ error: "Ingen mastermind-løsning generert ennå" }, { status: 503 })
  }

  const dailyGameStats: DailyGameStats = storedStats ?? {}
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

  const reward = completed && hasRewardedSlotsLeft(dailyGameStats) ? Math.max(0, mastermindValues.baseReward - mastermindValues.perGuessPenalty * numAttempts) : 0

  await firebase.updateUserFields(user.id, {
    // Added on the server rather than written as "what it was + reward": the balance may have changed since anyone last read it.
    ...(reward > 0 ? { chips: increment(reward) } : {}),
    "dailyGameStats/mastermind": { attempted: true, completed, numAttempts, guesses },
  })

  // After the answer has gone out - the player shouldn't wait for Discord to see how the guess went.
  if (completed) {
    after(() =>
      announceInChannel(user.channelId, {
        content: `<@${user.id}> klarte mastermind på ${numAttempts}/${mastermindValues.totalAttempts} forsøk${reward > 0 ? ` og fikk ${reward} chips!` : "!"}`,
      })
    )
  } else if (finished) {
    after(() => announceInChannel(user.channelId, { content: `<@${user.id}> klarte IKKE mastermind på ${mastermindValues.totalAttempts} forsøk!` }))
  }

  return Response.json({
    black: hint.black,
    white: hint.white,
    numAttempts,
    completed,
    reward,
    solution: finished && !completed ? solution : undefined,
  })
}
