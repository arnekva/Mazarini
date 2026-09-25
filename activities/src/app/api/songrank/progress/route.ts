import { isAdminUser } from "@/lib/admin"
import { FirebaseHelper } from "@/lib/db/firebaseHelper"
import { authenticateRequest } from "@/lib/discordAuth"

// Song Rank is admin-only, and so is its cloud save - one ranking per admin, other/songRank/{userId}.
const progressPath = (userId: string) => `other/songRank/${userId}`
const backupPath = (userId: string) => `other/songRankBackup/${userId}`
const MAX_FIELD_CHARS = 300_000

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  if (!isAdminUser(user.id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const progress = await new FirebaseHelper().getData(progressPath(user.id))
  return Response.json({ progress: progress ?? null })
}

export async function PUT(request: Request) {
  const { user, error } = await authenticateRequest(request)
  if (error) return error
  if (!isAdminUser(user.id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const valid =
    typeof body?.playlistId === "string" &&
    typeof body.order === "string" &&
    typeof body.rankedIds === "string" &&
    body.order.length <= MAX_FIELD_CHARS &&
    body.rankedIds.length <= MAX_FIELD_CHARS &&
    [body.processed, body.skippedCount, body.lo, body.hi].every((n) => Number.isFinite(n)) &&
    typeof body.pendingDecision === "boolean"
  if (!valid) return Response.json({ error: "Ugyldig data" }, { status: 400 })

  // Firebase rejects `undefined` values outright, so the doc is built field by field.
  const doc: Record<string, unknown> = {
    playlistId: body.playlistId,
    order: body.order,
    rankedIds: body.rankedIds,
    processed: body.processed,
    skippedCount: body.skippedCount,
    pendingDecision: body.pendingDecision,
    lo: body.lo,
    hi: body.hi,
    updatedAt: Date.now(),
  }
  if (typeof body.targetPlaylistId === "string" && body.targetPlaylistId) doc.targetPlaylistId = body.targetPlaylistId

  // A different `order` means a brand-new ranking is replacing this one - keep the old one around
  // if it had real progress, so a stray "start new" can't destroy it for good.
  const firebase = new FirebaseHelper()
  const existing = await firebase.getData(progressPath(user.id))
  if (existing && existing.order !== body.order && (existing.processed ?? 0) > 0) {
    await firebase.updateData({ [backupPath(user.id)]: existing })
  }
  await firebase.updateData({ [progressPath(user.id)]: doc })
  return Response.json({ ok: true })
}
