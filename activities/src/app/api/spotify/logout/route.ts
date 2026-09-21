import { NextResponse } from "next/server"
import { clearTokenCookies } from "@/lib/spotifyUserAuth"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  clearTokenCookies(res)
  return res
}
