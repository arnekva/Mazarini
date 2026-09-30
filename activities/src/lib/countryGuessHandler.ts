import { increment } from "firebase/database"
import { after } from "next/server"
import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { CountryChallenge, DailyGameStats, hasRewardedSlotsLeft, publicChallenge } from "./dailyHub"
import { announceInChannel } from "./discordMessage"
import { getGuessHint } from "./geo"
import { countryChallengeValues } from "./gameValues"

export type CountryGameId = "flag" | "outline" | "capital"

// Short noun-phrase form for the announce messages ("gjettet rett på ... flagget").
const shortLabels: Record<CountryGameId, string> = {
  flag: "flagget",
  outline: "landet fra outline",
  capital: "hovedstaden",
}

export function isCountryGameId(value: string): value is CountryGameId {
  return value === "flag" || value === "outline" || value === "capital"
}

export async function getCountryGameStatus(game: CountryGameId, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  // Just this game's puzzle and this player's count - not the whole shared storage and the whole user record they sit in.
  const [stat = {}, challenge]: [DailyGameStats[CountryGameId], CountryChallenge | undefined] = await Promise.all([
    firebase.getData(`users/${user.id}/dailyGameStats/${game}`),
    firebase.getData(`other/dailyHubChallenges/${game}`),
  ])
  if (!challenge) return Response.json({ error: "Ingen utfordring generert ennå" }, { status: 503 })

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
  const [dailyGameStats = {}, challenge]: [DailyGameStats, CountryChallenge | undefined] = await Promise.all([
    firebase.getData(`users/${user.id}/dailyGameStats`),
    firebase.getData(`other/dailyHubChallenges/${game}`),
  ])
  if (!challenge) return Response.json({ error: "Ingen utfordring generert ennå" }, { status: 503 })
  const stat = dailyGameStats[game] ?? {}

  if (stat.completed) return Response.json({ alreadyCompleted: true })
  if ((stat.numAttempts ?? 0) >= countryChallengeValues.maxAttempts) {
    return Response.json({ noAttemptsLeft: true, answer: challenge.answer })
  }

  const numAttempts = (stat.numAttempts ?? 0) + 1
  const correct = guess.trim().toLowerCase() === challenge.answer.trim().toLowerCase()

  if (correct) {
    const reward = hasRewardedSlotsLeft(dailyGameStats) ? countryChallengeValues.reward : 0

    await firebase.updateUserFields(user.id, {
      // Added on the server rather than written as "what it was + reward": the balance may have changed since anyone last read it.
      ...(reward > 0 ? { chips: increment(reward) } : {}),
      [`dailyGameStats/${game}`]: { attempted: true, completed: true, numAttempts },
    })

    // After the answer has gone out - the player shouldn't wait for Discord to hear they were right.
    after(() =>
      announceInChannel(user.channelId, {
        content: `<@${user.id}> gjettet rett på ${numAttempts}/${countryChallengeValues.maxAttempts} forsøk på ${shortLabels[game]}${
          reward > 0 ? ` og fikk ${reward} chips!` : "!"
        }`,
      })
    )

    return Response.json({ correct: true, reward, numAttempts })
  }

  const finished = numAttempts >= countryChallengeValues.maxAttempts
  await firebase.updateUserFields(user.id, {
    [`dailyGameStats/${game}`]: { attempted: true, completed: false, numAttempts },
  })

  if (finished) after(() => announceInChannel(user.channelId, { content: `<@${user.id}> gjettet FEIL på ${shortLabels[game]}!` }))

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
