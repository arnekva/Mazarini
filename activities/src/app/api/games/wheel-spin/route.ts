import { increment } from "firebase/database"
import { after } from "next/server"
import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"
import { announceInChannel, lootButtonComponent } from "@/lib/discordMessage"
import { isGrantableWheelReward } from "@/lib/gameValues"

// The client plays a several-second spin animation before revealing the result - announcing it in
// Discord immediately would let anyone reading the channel see the outcome before the wheel stops.
const ANNOUNCE_DELAY_MS = 5000
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface LuckyWheelReward {
  name: string
  weight: number
  type: string
  amount?: number
  quality?: string
}

// Weighted-random pick, mirroring the shape of storage.luckyWheel in Firebase (other/luckyWheel) -
// the server decides the outcome here, the client only ever finds out the result afterwards.
function pickWeighted(rewards: LuckyWheelReward[]): LuckyWheelReward {
  const totalWeight = rewards.reduce((sum, r) => sum + r.weight, 0)
  let roll = Math.random() * totalWeight
  for (const reward of rewards) {
    roll -= reward.weight
    if (roll <= 0) return reward
  }
  return rewards[rewards.length - 1]
}

// Mirrors what the old mazarini-activities app's rewardHelper.ts resolved (chips/shards/chest/box).
// dond, pack, and the effect_* reward types aren't wired up yet, so the wheel is drawn and spun without
// them (isGrantableWheelReward) - landing on one used to use up the spin and give nothing.
export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const firebase = new FirebaseHelper()
  // Just the spin count and the prize list - not the whole user record and the whole shared storage they sit in.
  const [dailySpins, configured] = await Promise.all([firebase.getData(`users/${user.id}/dailySpins`), firebase.getData("other/luckyWheel")])

  const spinsLeft = dailySpins ?? 1
  if (spinsLeft <= 0) return Response.json({ spun: false, noSpinsLeft: true })

  const rewards = ((configured ?? []) as LuckyWheelReward[]).filter((r) => isGrantableWheelReward(r.type))
  if (rewards.length === 0) return Response.json({ spun: false, error: "Ingen premier konfigurert" }, { status: 500 })

  const reward = pickWeighted(rewards)
  const updates: Record<string, unknown> = { dailySpins: spinsLeft - 1 }
  const resultText = reward.name

  // Chips and shards are added on the server rather than written as "what it was + prize": the bot changes the same numbers.
  if (reward.type === "chips") {
    updates.chips = increment(reward.amount ?? 0)
    after(async () => {
      await delay(ANNOUNCE_DELAY_MS)
      await announceInChannel(user.channelId, { content: `<@${user.id}> vant ${reward.amount} chips på Lykkehjulet!` })
    })
  } else if (reward.type === "shards") {
    updates["ccg/shards"] = increment(reward.amount ?? 0)
    after(async () => {
      await delay(ANNOUNCE_DELAY_MS)
      await announceInChannel(user.channelId, { content: `<@${user.id}> vant ${reward.amount} shards på Lykkehjulet!` })
    })
  } else if (reward.type === "chest" || reward.type === "box") {
    // Captured into a local const so the "chest" | "box" narrowing survives into the closure below -
    // TypeScript doesn't retain narrowing on a captured object's property across a nested function.
    const lootType = reward.type
    after(async () => {
      await delay(ANNOUNCE_DELAY_MS)
      await announceInChannel(user.channelId, {
        content: `<@${user.id}> vant en ${lootType} på Lykkehjulet!`,
        components: [lootButtonComponent(user.id, reward.quality ?? "basic", lootType)],
      })
    })
  }

  await firebase.updateUserFields(user.id, updates)

  return Response.json({ spun: true, reward: resultText, type: reward.type, supported: true, spinsLeft: spinsLeft - 1 })
}
