import { authenticateRequest } from "@/lib/discordAuth"
import { startMoreOrLessGame } from "@/lib/moreOrLessHandler"

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  return startMoreOrLessGame(user)
}
