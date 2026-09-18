import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"

// Just the prize list for drawing the wheel - listing all possible prizes reveals nothing about
// which one a spin will land on (that's still decided server-side in wheel-spin).
export async function GET(request: Request) {
  const { error } = await authenticateRequest(request)
  if (error) return error

  const firebase = new FirebaseHelper()
  const storage = (await firebase.getData("other")) ?? {}
  const rewards = (storage.luckyWheel ?? []).map((r: any) => ({ name: r.name, weight: r.weight, type: r.type }))

  return Response.json({ rewards })
}
