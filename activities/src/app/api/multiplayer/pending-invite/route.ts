import { authenticateRequest } from "@/lib/discordAuth"
import { consumePendingMultiplayerInvite } from "@/lib/multiplayerInvite"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  return consumePendingMultiplayerInvite(user)
}
