import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"
import { isGrantableWheelReward } from "@/lib/gameValues"

// Just the prize list for drawing the wheel - listing all possible prizes reveals nothing about
// which one a spin will land on (that's still decided server-side in wheel-spin).
export async function GET(request: Request) {
  const { error } = await authenticateRequest(request)
  if (error) return error

  const firebase = new FirebaseHelper()
  // Only the prizes a spin can actually land on - see wheel-spin.
  const configured: any[] = (await firebase.getData("other/luckyWheel")) ?? []
  const rewards = configured.filter((r) => isGrantableWheelReward(r.type)).map((r) => ({ name: r.name, weight: r.weight, type: r.type }))

  return Response.json({ rewards })
}
