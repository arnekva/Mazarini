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
  /** Only set on a user from authenticateRequest: the launch channel the client reported (X-Channel-Id) - unvalidated, see announceInChannel. */
  channelId?: string | null
}

/** Pulls the bearer token out of an incoming request's Authorization header, if present. */
export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  return header.slice("Bearer ".length)
}

/** How long a verified token is trusted before Discord is asked again. */
const VERIFIED_CACHE_MS = 10 * 60 * 1000
const VERIFIED_CACHE_MAX = 200
const verified = new Map<string, { user: Promise<AuthenticatedDiscordUser | null>; expires: number }>()

/**
 * Who this access token belongs to, according to Discord. The answer is remembered for a few minutes per warm server
 * instance: every poll of every game comes through here, and asking Discord each time put an external round trip in
 * front of every single request. The price is that a revoked token keeps working until its entry expires.
 */
export function verifyDiscordUser(accessToken: string | null): Promise<AuthenticatedDiscordUser | null> {
  if (!accessToken) return Promise.resolve(null)

  const now = Date.now()
  const hit = verified.get(accessToken)
  if (hit && hit.expires > now) return hit.user

  if (verified.size >= VERIFIED_CACHE_MAX) {
    for (const [token, entry] of verified) if (entry.expires <= now) verified.delete(token)
    if (verified.size >= VERIFIED_CACHE_MAX) verified.clear()
  }
  // The promise itself is cached, so requests arriving together share one lookup. A failed one isn't kept.
  const user = fetchDiscordUser(accessToken).catch(() => null)
  verified.set(accessToken, { user, expires: now + VERIFIED_CACHE_MS })
  user.then((u) => {
    if (!u && verified.get(accessToken)?.user === user) verified.delete(accessToken)
  })
  return user
}

async function fetchDiscordUser(accessToken: string): Promise<AuthenticatedDiscordUser | null> {
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
  return { user: { ...user, channelId: request.headers.get("x-channel-id") } }
}
