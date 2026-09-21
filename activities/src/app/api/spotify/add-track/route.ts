import { NextRequest, NextResponse } from "next/server"
import { getUserAuth } from "@/lib/spotifyUserAuth"

export async function POST(req: NextRequest) {
  const auth = await getUserAuth(req)
  if (!auth) return NextResponse.json({ error: "Ikke logget inn" }, { status: 401 })

  const { playlistId, trackId } = await req.json()
  if (!playlistId || !trackId) return NextResponse.json({ error: "Mangler playlistId eller trackId" }, { status: 400 })

  const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
  })

  if (!addRes.ok) {
    const status = addRes.status === 403 ? 403 : 502
    const message = status === 403 ? "Har ikke skrivetilgang til denne spillelisten" : "Klarte ikke å legge til låten"
    return NextResponse.json({ error: message }, { status })
  }

  const res = NextResponse.json({ ok: true })
  auth.applyCookies(res)
  return res
}
