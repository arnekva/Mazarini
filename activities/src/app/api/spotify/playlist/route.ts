import { NextRequest, NextResponse } from "next/server"
import { getSpotifyAppToken } from "@/lib/spotifyServerAuth"
import { extractPlaylistId } from "@/lib/spotifyIds"

export interface RankTrack {
  id: string
  name: string
  artists: string
  image?: string
  durationMs: number
}

// Collapses "Song Title - 2011 Remaster" / "Song Title (Live)" / "Song Title (feat. X)" down to the
// same key as plain "Song Title", so the same song released on a single vs. an album (different
// Spotify track IDs) is recognized as a duplicate instead of two separate entries.
function normalizeTitle(name: string): string {
  return name
    .toLowerCase()
    .split(" - ")[0]
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function normalizeArtists(artists: string): string {
  return artists
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .sort()
    .join(",")
}

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("playlist") ?? ""
  const playlistId = extractPlaylistId(input)
  if (!playlistId) return NextResponse.json({ error: "Fant ikke en gyldig spilleliste-ID i lenken" }, { status: 400 })

  try {
    const token = await getSpotifyAppToken()
    const byKey = new Map<string, { track: RankTrack; popularity: number }>()
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,name,duration_ms,popularity,artists(name),album(images)))`

    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        const status = res.status === 404 ? 404 : 502
        return NextResponse.json({ error: "Fant ikke spillelisten - er den offentlig?" }, { status })
      }
      const data = await res.json()
      for (const item of data.items ?? []) {
        const t = item.track
        if (!t || !t.id) continue // local files / removed tracks come back null
        const artists = (t.artists ?? []).map((a: { name: string }) => a.name).join(", ")
        const key = `${normalizeTitle(t.name)}|${normalizeArtists(artists)}`
        const popularity = t.popularity ?? 0
        const existing = byKey.get(key)
        if (existing && existing.popularity >= popularity) continue // keep the more popular edition already stored

        byKey.set(key, {
          popularity,
          track: {
            id: t.id,
            name: t.name,
            artists,
            image: t.album?.images?.[t.album.images.length - 1]?.url,
            durationMs: t.duration_ms,
          },
        })
      }
      url = data.next ?? null
    }

    const tracks = Array.from(byKey.values()).map((v) => v.track)
    if (tracks.length < 2) return NextResponse.json({ error: "Spillelisten trenger minst 2 låter" }, { status: 400 })
    return NextResponse.json({ tracks })
  } catch {
    return NextResponse.json({ error: "Klarte ikke å hente spillelisten" }, { status: 500 })
  }
}
