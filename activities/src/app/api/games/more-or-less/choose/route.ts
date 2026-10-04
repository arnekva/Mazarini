import { authenticateRequest } from "@/lib/discordAuth"
import { chooseMolCategory, getMolChoiceStatus } from "@/lib/molChoice"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  return getMolChoiceStatus(user)
}

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  const body = await request.json().catch(() => ({}))
  if (typeof body.slug !== "string" || !body.slug) return Response.json({ error: "Velg en kategori" }, { status: 400 })
  return chooseMolCategory(user, body.slug)
}
