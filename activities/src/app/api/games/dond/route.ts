import { authenticateRequest } from "@/lib/discordAuth"
import { answerDondOffer, dismissDond, getDondStatus, getDondWatch, keepOrSwitchDond, listActiveDondGames, openDondCase, postDondChat, startDond } from "@/lib/dondHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  const watch = new URL(request.url).searchParams.get("watch")
  if (watch) return getDondWatch(watch, user)
  if (new URL(request.url).searchParams.get("active")) return listActiveDondGames(user)
  return getDondStatus(user)
}

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const { action, tier, caseNr, deal, doSwitch, hostId, text } = await request.json()
  if (action === "start") return startDond(user, tier, caseNr)
  if (action === "open") return openDondCase(user, caseNr)
  if (action === "offer") return answerDondOffer(user, !!deal)
  if (action === "keepOrSwitch") return keepOrSwitchDond(user, !!doSwitch)
  if (action === "chat") return postDondChat(user, hostId, text)
  if (action === "dismiss") return dismissDond(user)
  return Response.json({ error: "Ukjent handling" }, { status: 400 })
}
