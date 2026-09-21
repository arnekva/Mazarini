import { authenticateRequest } from "@/lib/discordAuth"
import {
  createBlackjackLobby,
  dealBlackjackRound,
  getBlackjackLobbyStatus,
  hitBlackjack,
  joinBlackjackLobby,
  leaveBlackjackLobby,
  requestBlackjackRedeal,
  splitBlackjack,
  standBlackjack,
  voteBlackjackRedeal,
} from "@/lib/blackjackHandler"

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

    const params = new URL(request.url).searchParams
    const instanceId = params.get("instanceId")
    const lobbyId = params.get("lobbyId")
    if (!instanceId || !lobbyId) return Response.json({ error: "Mangler instanceId eller lobbyId" }, { status: 400 })

    return await getBlackjackLobbyStatus(instanceId, lobbyId, user)
  } catch (err) {
    return debugError(err)
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await authenticateRequest(request)
    if (error) return error

    const { instanceId, lobbyId, action, buyIn, approve } = await request.json()
    if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })

    if (action === "create") return await createBlackjackLobby(instanceId, user, buyIn)

    if (!lobbyId) return Response.json({ error: "Mangler lobbyId" }, { status: 400 })
    if (action === "join") return await joinBlackjackLobby(instanceId, lobbyId, user)
    if (action === "leave") return await leaveBlackjackLobby(instanceId, lobbyId, user)
    if (action === "deal") return await dealBlackjackRound(instanceId, lobbyId, user)
    if (action === "hit") return await hitBlackjack(instanceId, lobbyId, user)
    if (action === "stand") return await standBlackjack(instanceId, lobbyId, user)
    if (action === "split") return await splitBlackjack(instanceId, lobbyId, user)
    if (action === "requestRedeal") return await requestBlackjackRedeal(instanceId, lobbyId, user)
    if (action === "voteRedeal") return await voteBlackjackRedeal(instanceId, lobbyId, user, !!approve)
    return Response.json({ error: "Ukjent handling" }, { status: 400 })
  } catch (err) {
    return debugError(err)
  }
}
