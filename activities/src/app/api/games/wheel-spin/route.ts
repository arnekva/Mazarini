import { after } from "next/server"
import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"
import { lootButtonComponent, postChannelMessage } from "@/lib/discordMessage"
import { ANNOUNCE_CHANNEL_ID } from "@/lib/gameValues"

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
// dond, pack, and the effect_* reward types aren't wired up yet - a spin can still land on one
// (same gap the old app had), it just doesn't grant anything visible until those are built out.
export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const firebase = new FirebaseHelper()
  const dbUser = (await firebase.getUser(user.id)) ?? {}

  const spinsLeft = dbUser.dailySpins ?? 1
  if (spinsLeft <= 0) return Response.json({ spun: false, noSpinsLeft: true })

  const storage = (await firebase.getData("other")) ?? {}
  const rewards: LuckyWheelReward[] = storage.luckyWheel ?? []
  if (rewards.length === 0) return Response.json({ spun: false, error: "Ingen premier konfigurert" }, { status: 500 })

  const reward = pickWeighted(rewards)
  const updates: Record<string, unknown> = { dailySpins: spinsLeft - 1 }
  let resultText = reward.name
  let supported = true

  if (reward.type === "chips") {
    updates.chips = (dbUser.chips ?? 0) + (reward.amount ?? 0)
    after(async () => {
      await delay(ANNOUNCE_DELAY_MS)
      await postChannelMessage(ANNOUNCE_CHANNEL_ID, { content: `<@${user.id}> vant ${reward.amount} chips på Lykkehjulet!` })
    })
  } else if (reward.type === "shards") {
    updates.ccg = { ...dbUser.ccg, shards: (dbUser.ccg?.shards ?? 0) + (reward.amount ?? 0) }
    after(async () => {
      await delay(ANNOUNCE_DELAY_MS)
      await postChannelMessage(ANNOUNCE_CHANNEL_ID, { content: `<@${user.id}> vant ${reward.amount} shards på Lykkehjulet!` })
    })
  } else if (reward.type === "chest" || reward.type === "box") {
    after(async () => {
      await delay(ANNOUNCE_DELAY_MS)
      await postChannelMessage(ANNOUNCE_CHANNEL_ID, {
        content: `<@${user.id}> vant en ${reward.type} på Lykkehjulet!`,
        components: [lootButtonComponent(user.id, reward.quality ?? "basic", reward.type)],
      })
    })
  } else {
    // dond / pack / effect_* - not implemented yet, spin is still consumed
    supported = false
  }

  await firebase.updateUserFields(user.id, updates)

  return Response.json({ spun: true, reward: resultText, type: reward.type, supported, spinsLeft: spinsLeft - 1 })
}
