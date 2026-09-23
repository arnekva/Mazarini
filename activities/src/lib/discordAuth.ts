// Server-only. This is the single source of truth for "who is making this request" - every API
// route that grants chips or records a game result must go through verifyDiscordUser and use the
// id it returns, never an id the client claims in a request body.

import { devAuthEnabled } from "./env"

export interface AuthenticatedDiscordUser {
  id: string
  username: string
  globalName: string | null
  /** Avatar hash, or null for the default avatar - build a CDN URL with discordAvatarUrl() in ./discordAvatar. */
  avatar: string | null
}

/** Pulls the bearer token out of an incoming request's Authorization header, if present. */
export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  return header.slice("Bearer ".length)
}

/**
 * Asks Discord itself who this access token belongs to. Re-checked on every call by design -
 * there's no session/cache layer, so a revoked or expired token stops working immediately and
 * there's no local state to get out of sync with Discord.
 */
export async function verifyDiscordUser(accessToken: string | null): Promise<AuthenticatedDiscordUser | null> {
  if (!accessToken) return null

  // Local testing only (devAuthEnabled is always false in a production build): "dev:<id>:<name>".
  if (devAuthEnabled && accessToken.startsWith("dev:")) {
    const [, id, ...name] = accessToken.split(":")
    if (!id) return null
    return { id, username: name.join(":") || id, globalName: null, avatar: null }
  }

  const response = await fetch("https://discord.com/api/v10/oauth2/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return null

  const data = await response.json()
  if (!data?.user?.id) return null

  return {
    id: data.user.id,
    username: data.user.username,
    globalName: data.user.global_name ?? null,
    avatar: data.user.avatar ?? null,
  }
}

type AuthResult = { user: AuthenticatedDiscordUser; error?: undefined } | { user?: undefined; error: Response }

/** Standard entry point for an API route: resolves the caller or returns a 401 to send back as-is. */
export async function authenticateRequest(request: Request): Promise<AuthResult> {
  const token = extractBearerToken(request)
  const user = await verifyDiscordUser(token)
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  return { user }
}
