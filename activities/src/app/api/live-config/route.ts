import { authenticateRequest } from "@/lib/discordAuth"
import { database, firebaseConfig } from "@/lib/env"

// What the browser needs to listen to the database directly (see lib/liveSignal.ts). Handing this out means anyone who can open
// the Activity can read and write the database from their own browser - accepted on purpose: it's only ever used by the people in
// our own server. Served from here rather than from NEXT_PUBLIC_* variables so there's nothing extra to configure per deployment.
export async function GET(request: Request) {
  const { error } = await authenticateRequest(request)
  if (error) return error
  return Response.json({ firebase: firebaseConfig, database })
}
