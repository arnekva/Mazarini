import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"
import { getChallengesCompletedCount } from "@/lib/dailyHub"
import { MAX_REWARDED_CHALLENGES_PER_DAY } from "@/lib/gameValues"

// Initial state for the hub landing page - one call powers the Daily Claim / Lykkehjul button
// states and the four challenge cards, without the client ever having to compute or assert them itself.
export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const firebase = new FirebaseHelper()
  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const stats = dbUser.dailyGameStats ?? {}

  return Response.json({
    chips: dbUser.chips ?? 0,
    dailyClaimedToday: !!dbUser.daily?.claimedToday,
    dailyStreak: dbUser.daily?.streak ?? 0,
    wheelSpinsLeft: dbUser.dailySpins ?? 1,
    challengesCompleted: getChallengesCompletedCount(stats),
    maxChallenges: MAX_REWARDED_CHALLENGES_PER_DAY,
    challenges: {
      flag: { completed: !!stats.flag?.completed, numAttempts: stats.flag?.numAttempts ?? 0 },
      outline: { completed: !!stats.outline?.completed, numAttempts: stats.outline?.numAttempts ?? 0 },
      capital: { completed: !!stats.capital?.completed, numAttempts: stats.capital?.numAttempts ?? 0 },
      mastermind: { completed: !!stats.mastermind?.completed, numAttempts: stats.mastermind?.numAttempts ?? 0 },
    },
  })
}
