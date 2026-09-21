import { NextRequest, NextResponse } from "next/server"
import { spotifyClientId, spotifyClientSecret, spotifyRedirectUri } from "@/lib/env"
import { readAndClearStateCookie, setTokenCookies } from "@/lib/spotifyUserAuth"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  const error = req.nextUrl.searchParams.get("error")

  const redirectBack = (query: string) => NextResponse.redirect(new URL(`/song-rank${query}`, req.url))

  if (error) return redirectBack(`?spotifyError=${encodeURIComponent(error)}`)

  const res = redirectBack("")
  const expectedState = readAndClearStateCookie(req, res)
  if (!code || !state || state !== expectedState) {
    return redirectBack("?spotifyError=state_mismatch")
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: spotifyRedirectUri }).toString(),
  })
  if (!tokenRes.ok) return redirectBack("?spotifyError=token_exchange_failed")

  const data = await tokenRes.json()
  setTokenCookies(res, data.access_token, data.refresh_token, data.expires_in)
  return res
}
