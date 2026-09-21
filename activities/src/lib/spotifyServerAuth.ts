import { spotifyClientId, spotifyClientSecret } from "./env"

// Cached in module scope - client-credentials tokens are app-wide (not per-user) and last an
// hour, so every request in this process can share one instead of re-authing each time.
let cachedToken: { value: string; expiresAt: number } | null = null

export async function getSpotifyAppToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  if (!res.ok) throw new Error(`Spotify auth failed (${res.status})`)
  const data = await res.json()
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
  return cachedToken.value
}
