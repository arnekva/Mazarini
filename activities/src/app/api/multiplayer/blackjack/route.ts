import { authenticateRequest } from "@/lib/discordAuth"
import { dealBlackjackRound, getBlackjackStatus, hitBlackjack, joinBlackjackTable, standBlackjack, startBlackjackGame } from "@/lib/blackjackHandler"

// TEMPORARY while chasing intermittent 500s in production - surfaces the real error and stack
// instead of a bare 500, since there's no other way to see server logs from here right now.
// Remove once the multiplayer blackjack flow is confirmed stable.
function debugError(err: unknown) {
  console.error("Blackjack route error:", err)
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  return Response.json({ error: message, stack }, { status: 500 })
}

export async function GET(request: Request) {
  try {
    const { user, error } = await authenticateRequest(request)
    if (error) return error

    const instanceId = new URL(request.url).searchParams.get("instanceId")
    if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })

    return await getBlackjackStatus(instanceId)
  } catch (err) {
    return debugError(err)
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await authenticateRequest(request)
    if (error) return error

    const { instanceId, action, buyIn } = await request.json()
    if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })

    if (action === "join") return await joinBlackjackTable(instanceId, user)
    if (action === "start") return await startBlackjackGame(instanceId, user, buyIn)
    if (action === "deal") return await dealBlackjackRound(instanceId, user)
    if (action === "hit") return await hitBlackjack(instanceId, user)
    if (action === "stand") return await standBlackjack(instanceId, user)
    return Response.json({ error: "Ukjent handling" }, { status: 400 })
  } catch (err) {
    return debugError(err)
  }
}
