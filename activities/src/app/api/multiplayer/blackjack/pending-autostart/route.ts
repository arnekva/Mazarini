import { authenticateRequest } from "@/lib/discordAuth"
import { consumePendingBlackjackAutoStart } from "@/lib/blackjackHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  return consumePendingBlackjackAutoStart(user)
}
