import { authenticateRequest } from "@/lib/discordAuth"
import {
  createRedBlackLobby,
  getRedBlackLobbyStatus,
  joinRedBlackLobby,
  leaveRedBlackLobby,
  redBlackAction,
  spectateRedBlackLobby,
} from "@/lib/redBlackHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const params = new URL(request.url).searchParams
  const instanceId = params.get("instanceId")
  const lobbyId = params.get("lobbyId")
  if (!instanceId || !lobbyId) return Response.json({ error: "Mangler instanceId eller lobbyId" }, { status: 400 })

  return getRedBlackLobbyStatus(instanceId, lobbyId, user)
}

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const { instanceId, lobbyId, action, guess, loserId } = await request.json()
  if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })

  if (action === "create") return createRedBlackLobby(instanceId, user)

  if (!lobbyId) return Response.json({ error: "Mangler lobbyId" }, { status: 400 })
  if (action === "join") return joinRedBlackLobby(instanceId, lobbyId, user)
  if (action === "spectate") return spectateRedBlackLobby(instanceId, lobbyId, user)
  if (action === "leave") return leaveRedBlackLobby(instanceId, lobbyId, user)
  return redBlackAction(instanceId, lobbyId, user, action, { guess, loserId })
}
