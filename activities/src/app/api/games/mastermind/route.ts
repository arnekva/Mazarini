import { authenticateRequest } from "@/lib/discordAuth"
import { getMastermindStatus, submitMastermindGuess } from "@/lib/mastermindHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  return getMastermindStatus(user)
}

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const { guess } = await request.json()
  return submitMastermindGuess(user, guess)
}
