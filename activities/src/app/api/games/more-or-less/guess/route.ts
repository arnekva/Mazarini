import { authenticateRequest } from "@/lib/discordAuth"
import { guessMoreOrLess } from "@/lib/moreOrLessHandler"

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error

  const { more } = await request.json()
  if (typeof more !== "boolean") return Response.json({ error: "Missing more" }, { status: 400 })

  return guessMoreOrLess(user, more)
}
