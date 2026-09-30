import { increment } from "firebase/database"
import { after } from "next/server"
import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"
import { announceInChannel, lootButtonComponent } from "@/lib/discordMessage"
import { dailyClaimValues, JAIL_MULTIPLIER } from "@/lib/gameValues"

// Mirrors commands/money/dailyClaimCommands.ts in the bot repo: same reward formula, same
// claimedToday/streak fields (so /daily in chat and this button stay in sync), same jail penalty,
// same "streak 7 grants a lootbox, then resets to 0" behaviour.
export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const firebase = new FirebaseHelper()
  // The three things a claim depends on - not the whole user record.
  const [daily, daysInJail, chipsBefore] = await Promise.all([
    firebase.getData(`users/${user.id}/daily`),
    firebase.getData(`users/${user.id}/jail/daysInJail`),
    firebase.getChips(user.id),
  ])

  if (daily?.claimedToday) {
    return Response.json({ claimed: false, alreadyClaimed: true, streak: daily?.streak ?? 0 })
  }

  const newStreak = (daily?.streak ?? 0) + 1
  const inJail = (daysInJail ?? 0) > 0

  let reward = dailyClaimValues.baseReward + dailyClaimValues.baseReward * newStreak * dailyClaimValues.streakMultiplier
  if (inJail) reward *= JAIL_MULTIPLIER
  reward = Math.floor(reward)

  const chips = chipsBefore + reward
  const lootAwarded = newStreak === 7
  const finalStreak = lootAwarded ? 0 : newStreak

  await firebase.updateUserFields(user.id, {
    // Added on the server rather than written as "what it was + reward": the balance may have changed since it was read.
    chips: increment(reward),
    // The two fields a claim changes, not the whole `daily` object - whatever else is kept there stays.
    "daily/claimedToday": true,
    "daily/streak": finalStreak,
  })

  if (lootAwarded && dailyClaimValues.streak7Reward === "chest") {
    after(() =>
      announceInChannel(user.channelId, {
        content: `<@${user.id}> nådde 7 dager i strekk på Daily Claim og fikk en kiste!`,
        components: [lootButtonComponent(user.id, "basic", "chest")],
      })
    )
  }

  return Response.json({ claimed: true, reward, streak: newStreak, chips, lootAwarded })
}
