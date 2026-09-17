import { authenticateRequest } from "@/lib/discordAuth"
import { getCountryGameStatus, isCountryGameId, submitCountryGuess } from "@/lib/countryGuessHandler"

export async function GET(request: Request, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params
  if (!isCountryGameId(game)) return Response.json({ error: "Unknown game" }, { status: 404 })

  const { user, error } = await authenticateRequest(request)
  if (error) return error

  return getCountryGameStatus(game, user)
}

export async function POST(request: Request, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params
  if (!isCountryGameId(game)) return Response.json({ error: "Unknown game" }, { status: 404 })

  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const { guess } = await request.json()
  if (typeof guess !== "string" || !guess) return Response.json({ error: "Missing guess" }, { status: 400 })

  return submitCountryGuess(game, user, guess)
}
