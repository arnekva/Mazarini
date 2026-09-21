import { authenticateRequest } from "@/lib/discordAuth"
import { dealBlackjackRound, getBlackjackStatus, hitBlackjack, joinBlackjackTable, standBlackjack } from "@/lib/blackjackHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const instanceId = new URL(request.url).searchParams.get("instanceId")
  if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })

  return getBlackjackStatus(instanceId)
}

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const { instanceId, action } = await request.json()
  if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })

  if (action === "join") return joinBlackjackTable(instanceId, user)
  if (action === "deal") return dealBlackjackRound(instanceId, user)
  if (action === "hit") return hitBlackjack(instanceId, user)
  if (action === "stand") return standBlackjack(instanceId, user)
  return Response.json({ error: "Ukjent handling" }, { status: 400 })
}
