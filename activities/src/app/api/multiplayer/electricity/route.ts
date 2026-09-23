import { authenticateRequest } from "@/lib/discordAuth"
import {
  createElectricityLobby,
  drawElectricityCard,
  getElectricityLobbyStatus,
  joinElectricityLobby,
  leaveElectricityLobby,
  reshuffleElectricity,
  spectateElectricityLobby,
  startElectricity,
} from "@/lib/electricityHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const params = new URL(request.url).searchParams
  const instanceId = params.get("instanceId")
  const lobbyId = params.get("lobbyId")
  if (!instanceId || !lobbyId) return Response.json({ error: "Mangler instanceId eller lobbyId" }, { status: 400 })

  return getElectricityLobbyStatus(instanceId, lobbyId, user)
}

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const { instanceId, lobbyId, action, chugOnLoop } = await request.json()
  if (!instanceId) return Response.json({ error: "Mangler instanceId" }, { status: 400 })

  if (action === "create") return createElectricityLobby(instanceId, user, chugOnLoop !== false)

  if (!lobbyId) return Response.json({ error: "Mangler lobbyId" }, { status: 400 })
  if (action === "join") return joinElectricityLobby(instanceId, lobbyId, user)
  if (action === "spectate") return spectateElectricityLobby(instanceId, lobbyId, user)
  if (action === "leave") return leaveElectricityLobby(instanceId, lobbyId, user)
  if (action === "start") return startElectricity(instanceId, lobbyId, user)
  if (action === "draw") return drawElectricityCard(instanceId, lobbyId, user)
  if (action === "reshuffle") return reshuffleElectricity(instanceId, lobbyId, user)
  return Response.json({ error: "Ukjent handling" }, { status: 400 })
}
