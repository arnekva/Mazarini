import { NextRequest, NextResponse } from "next/server"
import { spotifyClientId, spotifyClientSecret } from "./env"

const ACCESS_COOKIE = "sp_access"
const EXPIRES_COOKIE = "sp_access_expires"
const REFRESH_COOKIE = "sp_refresh"
const STATE_COOKIE = "sp_oauth_state"

const secure = process.env.NODE_ENV === "production"

export function setStateCookie(res: NextResponse, state: string) {
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure, sameSite: "lax", maxAge: 600, path: "/" })
}

export function readAndClearStateCookie(req: NextRequest, res: NextResponse): string | undefined {
  const value = req.cookies.get(STATE_COOKIE)?.value
  res.cookies.delete(STATE_COOKIE)
  return value
}

export function setTokenCookies(res: NextResponse, accessToken: string, refreshToken: string | undefined, expiresIn: number) {
  res.cookies.set(ACCESS_COOKIE, accessToken, { httpOnly: true, secure, sameSite: "lax", maxAge: expiresIn, path: "/" })
  res.cookies.set(EXPIRES_COOKIE, String(Date.now() + expiresIn * 1000), { httpOnly: true, secure, sameSite: "lax", maxAge: expiresIn, path: "/" })
  if (refreshToken) {
    // Spotify refresh tokens don't expire on their own - keep it around for a long time.
    res.cookies.set(REFRESH_COOKIE, refreshToken, { httpOnly: true, secure, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" })
  }
}

export function clearTokenCookies(res: NextResponse) {
  res.cookies.delete(ACCESS_COOKIE)
  res.cookies.delete(EXPIRES_COOKIE)
  res.cookies.delete(REFRESH_COOKIE)
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString(),
  })
  if (!res.ok) return null
  return res.json() as Promise<{ access_token: string; expires_in: number; refresh_token?: string }>
}

/**
 * Reads the user's Spotify access token from cookies, transparently refreshing it if it's expired
 * (or close to it). Returns null if the user was never logged in or the refresh token was revoked.
 * `applyCookies` must be called on whatever NextResponse the caller ends up returning, so a
 * refreshed token actually gets persisted back to the browser.
 */
export async function getUserAuth(req: NextRequest): Promise<{ accessToken: string; applyCookies: (res: NextResponse) => void } | null> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value
  const expires = Number(req.cookies.get(EXPIRES_COOKIE)?.value ?? 0)
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value

  if (access && Date.now() < expires - 30_000) {
    return { accessToken: access, applyCookies: () => {} }
  }
  if (!refresh) return null

  const refreshed = await refreshAccessToken(refresh)
  if (!refreshed) return null

  return {
    accessToken: refreshed.access_token,
    applyCookies: (res) => setTokenCookies(res, refreshed.access_token, refreshed.refresh_token, refreshed.expires_in),
  }
}
