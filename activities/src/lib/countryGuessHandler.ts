import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { CountryChallenge, DailyGameStats, DailyHubChallenges, hasRewardedSlotsLeft, publicChallenge } from "./dailyHub"
import { postChannelMessage } from "./discordMessage"
import { getGuessHint } from "./geo"
import { ANNOUNCE_CHANNEL_ID, countryChallengeValues } from "./gameValues"

export type CountryGameId = "flag" | "outline" | "capital"

const gameLabels: Record<CountryGameId, string> = {
  flag: "Gjett flagget",
  outline: "Gjett landet fra outline",
  capital: "Si hovedstaden",
}

export function isCountryGameId(value: string): value is CountryGameId {
  return value === "flag" || value === "outline" || value === "capital"
}

export async function getCountryGameStatus(game: CountryGameId, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const [dbUser, storage] = await Promise.all([firebase.getUser(user.id), firebase.getData("other")])
  const challenges = storage?.dailyHubChallenges as DailyHubChallenges | undefined

  if (!challenges) return Response.json({ error: "Ingen utfordring generert ennå" }, { status: 503 })

  const challenge = challenges[game] as CountryChallenge
  const stat = dbUser?.dailyGameStats?.[game] ?? {}

  return Response.json({
    challenge: publicChallenge(challenge),
    attempted: !!stat.attempted,
    completed: !!stat.completed,
    numAttempts: stat.numAttempts ?? 0,
    maxAttempts: countryChallengeValues.maxAttempts,
  })
}

export async function submitCountryGuess(game: CountryGameId, user: AuthenticatedDiscordUser, guess: string) {
  const firebase = new FirebaseHelper()
  const [dbUser, storage] = await Promise.all([firebase.getUser(user.id), firebase.getData("other")])
  const challenges = storage?.dailyHubChallenges as DailyHubChallenges | undefined
  if (!challenges) return Response.json({ error: "Ingen utfordring generert ennå" }, { status: 503 })

  const challenge = challenges[game] as CountryChallenge
  const dailyGameStats: DailyGameStats = dbUser?.dailyGameStats ?? {}
  const stat = dailyGameStats[game] ?? {}

  if (stat.completed) return Response.json({ alreadyCompleted: true })
  if ((stat.numAttempts ?? 0) >= countryChallengeValues.maxAttempts) {
    return Response.json({ noAttemptsLeft: true, answer: challenge.answer })
  }

  const numAttempts = (stat.numAttempts ?? 0) + 1
  const correct = guess.trim().toLowerCase() === challenge.answer.trim().toLowerCase()

  if (correct) {
    const reward = hasRewardedSlotsLeft(dailyGameStats) ? countryChallengeValues.reward : 0
    const chips = (dbUser.chips ?? 0) + reward

    await firebase.updateUserFields(user.id, {
      chips,
      [`dailyGameStats/${game}`]: { attempted: true, completed: true, numAttempts },
    })

    await postChannelMessage(ANNOUNCE_CHANNEL_ID, {
      content: `<@${user.id}> fullførte **${gameLabels[game]}** på ${numAttempts} forsøk${reward > 0 ? ` og fikk ${reward} chips!` : "!"}`,
    })

    return Response.json({ correct: true, reward, chips, numAttempts })
  }

  const finished = numAttempts >= countryChallengeValues.maxAttempts
  await firebase.updateUserFields(user.id, {
    [`dailyGameStats/${game}`]: { attempted: true, completed: false, numAttempts },
  })

  // No hint once the answer is being revealed outright - it'd just be redundant noise at that point.
  const hint = finished ? undefined : getGuessHint(game === "capital" ? "capital" : "country", guess, challenge.answer)

  return Response.json({
    correct: false,
    numAttempts,
    attemptsLeft: countryChallengeValues.maxAttempts - numAttempts,
    revealAnswer: finished ? challenge.answer : undefined,
    hint,
  })
}
