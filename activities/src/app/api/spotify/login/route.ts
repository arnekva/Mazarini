import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { spotifyClientId, spotifyRedirectUri } from "@/lib/env"
import { setStateCookie } from "@/lib/spotifyUserAuth"

// Write access to build/append to a real playlist as songs are confirmed "keep".
const SCOPES = "playlist-modify-public playlist-modify-private"

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex")
  const authorizeUrl = new URL("https://accounts.spotify.com/authorize")
  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("client_id", spotifyClientId)
  authorizeUrl.searchParams.set("scope", SCOPES)
  authorizeUrl.searchParams.set("redirect_uri", spotifyRedirectUri)
  authorizeUrl.searchParams.set("state", state)

  const res = NextResponse.redirect(authorizeUrl)
  setStateCookie(res, state)
  return res
}
