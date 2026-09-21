import { NextRequest, NextResponse } from "next/server"
import { getUserAuth } from "@/lib/spotifyUserAuth"

export async function GET(req: NextRequest) {
  const auth = await getUserAuth(req)
  if (!auth) return NextResponse.json({ loggedIn: false })

  const meRes = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
  if (!meRes.ok) return NextResponse.json({ loggedIn: false })
  const me = await meRes.json()

  const res = NextResponse.json({ loggedIn: true, displayName: me.display_name as string })
  auth.applyCookies(res)
  return res
}
