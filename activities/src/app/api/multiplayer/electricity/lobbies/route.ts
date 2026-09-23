import { authenticateRequest } from "@/lib/discordAuth"
import { listElectricityLobbies } from "@/lib/electricityHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const instanceId = new URL(request.url).searchParams.get("instanceId")
  if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })

  return listElectricityLobbies(instanceId, user.id)
}
