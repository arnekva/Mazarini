import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"
import { readDailyGift } from "@/lib/dailyGift"
import { getChallengesCompletedCount, getRewardedSlotsUsed } from "@/lib/dailyHub"
import { DAILY_CHALLENGE_COUNT, MAX_REWARDED_CHALLENGES_PER_DAY } from "@/lib/gameValues"

// Initial state for the hub landing page - one call powers the Daily Claim / Lykkehjul button
// states and the four challenge cards, without the client ever having to compute or assert them itself.
export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const firebase = new FirebaseHelper()
  const [dbUser, gift, flagItems] = await Promise.all([
    firebase.getUser(user.id).then((u) => u ?? {}),
    readDailyGift(firebase),
    // Just the day's flags - how many items each country game has today (1 = as it used to be).
    firebase.getData("other/dailyHubChallenges/flag/items"),
  ])
  const itemsPerGame: number = Array.isArray(flagItems) && flagItems.length > 0 ? flagItems.length : 1
  const stats = dbUser.dailyGameStats ?? {}

  return Response.json({
    chips: dbUser.chips ?? 0,
    dailyClaimedToday: !!dbUser.daily?.claimedToday,
    dailyStreak: dbUser.daily?.streak ?? 0,
    // An admin-picked gift (see lib/dailyGift.ts) this person can still choose from the Daily claim page.
    giftWaiting: !!gift && gift.recipients.includes(user.id) && !gift.claims?.[user.id],
    wheelSpinsLeft: dbUser.dailySpins ?? 1,
    dondTokens: (dbUser.dondTokens?.basic ?? 0) + (dbUser.dondTokens?.premium ?? 0) + (dbUser.dondTokens?.elite ?? 0) + (dbUser.dondTokens?.legendary ?? 0),
    // One item per game: the shared pool of rewarded slots, as ever ("X/3", capped - a 4th completion is real but earns nothing).
    // Several: nothing is capped, so it's simply how many of the four are played through.
    itemsPerGame,
    challengesCompleted: itemsPerGame === 1 ? Math.min(getRewardedSlotsUsed(stats), MAX_REWARDED_CHALLENGES_PER_DAY) : getChallengesCompletedCount(stats),
    maxChallenges: itemsPerGame === 1 ? MAX_REWARDED_CHALLENGES_PER_DAY : DAILY_CHALLENGE_COUNT,
    challenges: {
      flag: { completed: !!stats.flag?.completed, numAttempts: stats.flag?.numAttempts ?? 0, correct: stats.flag?.correct ?? 0, settled: stats.flag?.index ?? 0 },
      outline: { completed: !!stats.outline?.completed, numAttempts: stats.outline?.numAttempts ?? 0, correct: stats.outline?.correct ?? 0, settled: stats.outline?.index ?? 0 },
      capital: { completed: !!stats.capital?.completed, numAttempts: stats.capital?.numAttempts ?? 0, correct: stats.capital?.correct ?? 0, settled: stats.capital?.index ?? 0 },
      mastermind: { completed: !!stats.mastermind?.completed, numAttempts: stats.mastermind?.numAttempts ?? 0 },
    },
  })
}
