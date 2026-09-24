import { authenticateRequest } from "@/lib/discordAuth"
import { clearRouletteBets, getRouletteTable, placeRouletteBet, readyRouletteSpin } from "@/lib/rouletteHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const instanceId = new URL(request.url).searchParams.get("instanceId")
  if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })
  return getRouletteTable(instanceId, user)
}

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const { instanceId, action, type, value, stake } = await request.json()
  if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })

  if (action === "bet") return placeRouletteBet(instanceId, user, { type, value, stake })
  if (action === "clear") return clearRouletteBets(instanceId, user)
  if (action === "spin") return readyRouletteSpin(instanceId, user)
  return Response.json({ error: "Ukjent handling" }, { status: 400 })
}
