import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"
import { lootButtonComponent, postChannelMessage } from "@/lib/discordMessage"
import { ANNOUNCE_CHANNEL_ID, dailyClaimValues, JAIL_MULTIPLIER } from "@/lib/gameValues"

// Mirrors commands/money/dailyClaimCommands.ts in the bot repo: same reward formula, same
// claimedToday/streak fields (so /daily in chat and this button stay in sync), same jail penalty,
// same "streak 7 grants a lootbox, then resets to 0" behaviour.
export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const firebase = new FirebaseHelper()
  const dbUser = (await firebase.getUser(user.id)) ?? {}

  if (dbUser.daily?.claimedToday) {
    return Response.json({ claimed: false, alreadyClaimed: true, streak: dbUser.daily?.streak ?? 0 })
  }

  const newStreak = (dbUser.daily?.streak ?? 0) + 1
  const inJail = (dbUser.jail?.daysInJail ?? 0) > 0

  let reward = dailyClaimValues.baseReward + dailyClaimValues.baseReward * newStreak * dailyClaimValues.streakMultiplier
  if (inJail) reward *= JAIL_MULTIPLIER
  reward = Math.floor(reward)

  const chips = (dbUser.chips ?? 0) + reward
  const lootAwarded = newStreak === 7
  const finalStreak = lootAwarded ? 0 : newStreak

  await firebase.updateUserFields(user.id, {
    chips,
    daily: { claimedToday: true, streak: finalStreak },
  })

  if (lootAwarded && dailyClaimValues.streak7Reward === "chest") {
    await postChannelMessage(ANNOUNCE_CHANNEL_ID, {
      content: `<@${user.id}> nådde 7 dager i strekk på Daily Claim og fikk en kiste!`,
      components: [lootButtonComponent(user.id, "basic", "chest")],
    })
  }

  return Response.json({ claimed: true, reward, streak: newStreak, chips, lootAwarded })
}
