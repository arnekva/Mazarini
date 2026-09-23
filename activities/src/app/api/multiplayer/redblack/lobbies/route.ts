import { authenticateRequest } from "@/lib/discordAuth"
import { listRedBlackLobbies } from "@/lib/redBlackHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const instanceId = new URL(request.url).searchParams.get("instanceId")
  if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })

  return listRedBlackLobbies(instanceId, user.id)
}
