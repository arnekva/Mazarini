import { authenticateRequest } from "@/lib/discordAuth"
import { consumePendingBlackjackSpectate } from "@/lib/blackjackHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  return consumePendingBlackjackSpectate(user)
}
