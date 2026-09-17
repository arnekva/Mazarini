import { discordClientId, discordClientSecret } from "@/lib/env"

export async function POST(request: Request) {
  const { code } = await request.json()

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: discordClientId,
      client_secret: discordClientSecret,
      grant_type: "authorization_code",
      code,
    }),
  })

  const { access_token } = await response.json()
  return Response.json({ access_token })
}
