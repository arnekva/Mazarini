import { authenticateRequest } from "@/lib/discordAuth"
import { consumePendingDondSpectate } from "@/lib/dondHandler"

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  return consumePendingDondSpectate(user)
}
