import { authenticateRequest } from "@/lib/discordAuth"
import { getMoreOrLessStatus } from "@/lib/moreOrLessHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  return getMoreOrLessStatus(user)
}
