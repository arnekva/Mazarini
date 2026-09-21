import { authenticateRequest } from "@/lib/discordAuth"
import { consumePendingBlackjackAutoStart, peekPendingBlackjackAutoStart } from "@/lib/blackjackHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const peek = new URL(request.url).searchParams.get("peek")
  if (peek) return peekPendingBlackjackAutoStart(user.id)
  return consumePendingBlackjackAutoStart(user)
}
