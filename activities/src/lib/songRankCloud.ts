import type { RankTrack } from "@/app/api/spotify/playlist/route"
import { callApi } from "./apiClient"
import type { RankState } from "./songRanker"

// Firebase copy of a ranking, stored as song ids only (a full RankState with 1000+ track objects is
// hundreds of KB - far too heavy to write on every click). Track details are re-fetched from the
// playlist on restore. `order` is the shuffled processing order; the queue is always the tail of it.
export interface CompactProgress {
  playlistId: string
  targetPlaylistId?: string
  order: string
  rankedIds: string
  processed: number
  skippedCount: number
  pendingDecision: boolean
  lo: number
  hi: number
  updatedAt?: number
}

export function toCompact(state: RankState): CompactProgress {
  const compact: CompactProgress = {
    playlistId: state.playlistId,
    order: state.allTracks.map((t) => t.id).join(","),
    rankedIds: state.ranked.map((t) => t.id).join(","),
    processed: state.allTracks.length - state.queue.length,
    skippedCount: state.skippedCount,
    pendingDecision: state.pendingDecision,
    lo: state.lo,
    hi: state.hi,
  }
  if (state.targetPlaylistId) compact.targetPlaylistId = state.targetPlaylistId
  return compact
}

/** Rebuilds a full state from a compact save plus the playlist's current tracks. Songs that have
 * since left the playlist are dropped; if that happened, the in-progress comparison is reset to a
 * fresh keep/skip decision instead of trusting now-stale binary-search bounds. */
export function fromCompact(compact: CompactProgress, tracks: RankTrack[]): RankState {
  const byId = new Map(tracks.map((t) => [t.id, t]))
  const orderIds = compact.order.split(",").filter(Boolean)
  const rankedIds = compact.rankedIds.split(",").filter(Boolean)

  const allTracks = orderIds.map((id) => byId.get(id)).filter((t): t is RankTrack => !!t)
  const ranked = rankedIds.map((id) => byId.get(id)).filter((t): t is RankTrack => !!t)
  const processed = orderIds.slice(0, compact.processed).filter((id) => byId.has(id)).length
  const intact = allTracks.length === orderIds.length && ranked.length === rankedIds.length

  return {
    playlistId: compact.playlistId,
    ...(compact.targetPlaylistId ? { targetPlaylistId: compact.targetPlaylistId } : {}),
    allTracks,
    queue: allTracks.slice(processed),
    pendingDecision: intact ? compact.pendingDecision : true,
    skippedCount: compact.skippedCount,
    ranked,
    lo: intact ? compact.lo : 0,
    hi: intact ? compact.hi : 0,
  }
}

export async function loadCloudProgress(accessToken: string): Promise<CompactProgress | null> {
  const res = await callApi<{ progress: CompactProgress | null }>("/api/songrank/progress", accessToken)
  return res.progress
}

export async function saveCloudProgress(accessToken: string, compact: CompactProgress): Promise<void> {
  await callApi("/api/songrank/progress", accessToken, { method: "PUT", body: JSON.stringify(compact) })
}
