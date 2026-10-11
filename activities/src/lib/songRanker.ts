import { trackKey } from "./trackKey"
import { RankTrack } from "@/app/api/spotify/playlist/route"

export interface RankState {
  playlistId: string
  /** Spotify playlist ID that confirmed "keep" tracks get live-added to, if the user set one up. */
  targetPlaylistId?: string
  /** Full fetched playlist, in a fixed (shuffled once) order - source of truth for resuming and for the total count. */
  allTracks: RankTrack[]
  /** Not yet processed, front = current candidate. */
  queue: RankTrack[]
  /** True while the current candidate (queue[0]) still needs a skip/keep decision, before any comparisons start. */
  pendingDecision: boolean
  skippedCount: number
  /** Confirmed-kept tracks, always kept fully sorted best-to-worst. */
  ranked: RankTrack[]
  /** Binary-search window into `ranked` for placing the current candidate, once it's been kept. */
  lo: number
  hi: number
}

export function init(playlistId: string, tracks: RankTrack[], targetPlaylistId?: string): RankState {
  const queue = [...tracks].sort(() => Math.random() - 0.5)
  return { playlistId, targetPlaylistId, allTracks: queue, queue, pendingDecision: queue.length > 0, skippedCount: 0, ranked: [], lo: 0, hi: 0 }
}

export function isFinished(state: RankState): boolean {
  return state.queue.length === 0
}

/** The track currently awaiting a skip/keep decision, before it enters comparisons. */
export function currentCandidate(state: RankState): RankTrack | null {
  if (!state.pendingDecision || state.queue.length === 0) return null
  return state.queue[0]
}

/** The track currently being placed, and the ranked track it's being compared against. */
export function currentComparison(state: RankState): { candidate: RankTrack; opponent: RankTrack } | null {
  if (state.pendingDecision || state.queue.length === 0) return null
  const candidate = state.queue[0]
  const mid = Math.floor((state.lo + state.hi) / 2)
  return { candidate, opponent: state.ranked[mid] }
}

function advanceToNext(state: RankState, queue: RankTrack[]): Pick<RankState, "queue" | "pendingDecision" | "lo" | "hi"> {
  return { queue, pendingDecision: queue.length > 0, lo: 0, hi: 0 }
}

/** Skip the current candidate entirely - it never enters the ranking. */
export function skip(state: RankState): RankState {
  const [, ...rest] = state.queue
  return { ...state, skippedCount: state.skippedCount + 1, ...advanceToNext(state, rest) }
}

/** Keep the current candidate - either seat it directly (nothing ranked yet) or start comparing it in. */
export function keep(state: RankState): RankState {
  if (state.ranked.length === 0) {
    const [candidate, ...rest] = state.queue
    return { ...state, ranked: [candidate], ...advanceToNext(state, rest) }
  }
  return { ...state, pendingDecision: false, lo: 0, hi: state.ranked.length }
}

/** Record that the candidate was judged better (or not) than the current opponent, advancing the binary search. */
export function answer(state: RankState, candidateIsBetter: boolean): RankState {
  const mid = Math.floor((state.lo + state.hi) / 2)
  const lo = candidateIsBetter ? state.lo : mid + 1
  const hi = candidateIsBetter ? mid : state.hi

  if (lo >= hi) {
    const candidate = state.queue[0]
    const ranked = [...state.ranked.slice(0, lo), candidate, ...state.ranked.slice(lo)]
    return { ...state, ranked, ...advanceToNext(state, state.queue.slice(1)) }
  }
  return { ...state, lo, hi }
}

/** Cleans a restored ranking of songs that are in it twice - e.g. a single and an album edition, ranked before the playlist fetch learned to
 * collapse those. The better-ranked copy stays, so no ranking position is lost. If `current` (the playlist as fetched now) is given, a track
 * whose edition has been replaced there is swapped for the current one, so what's saved lines up with what the next fetch returns.
 * Returns the same object when there was nothing to clean up. */
export function dedupe(state: RankState, current?: RankTrack[]): RankState {
  const currentIds = new Set((current ?? []).map((t) => t.id))
  const currentByKey = new Map((current ?? []).map((t) => [trackKey(t.name, t.artists), t]))
  const resolve = (t: RankTrack) => (currentIds.has(t.id) ? t : currentByKey.get(trackKey(t.name, t.artists)) ?? t)
  const keyOf = (t: RankTrack) => trackKey(t.name, t.artists)

  const rankedKeys = new Set<string>()
  const ranked: RankTrack[] = []
  for (const t of state.ranked.map(resolve)) {
    if (rankedKeys.has(keyOf(t))) continue
    rankedKeys.add(keyOf(t))
    ranked.push(t)
  }

  // The processed part of the order (everything before the queue): every ranked song, plus the skipped ones that aren't copies of something else.
  const processedCount = state.allTracks.length - state.queue.length
  const seen = new Set(rankedKeys)
  const processed: RankTrack[] = [...ranked]
  for (const t of state.allTracks.slice(0, processedCount).map(resolve)) {
    if (seen.has(keyOf(t))) continue
    seen.add(keyOf(t))
    processed.push(t)
  }
  // The songs still to come - anything already ranked or skipped (or repeated here) is gone from it.
  const queue: RankTrack[] = []
  for (const t of state.queue.map(resolve)) {
    if (seen.has(keyOf(t))) continue
    seen.add(keyOf(t))
    queue.push(t)
  }

  const unchanged =
    ranked.length === state.ranked.length &&
    queue.length === state.queue.length &&
    processed.length === processedCount &&
    ranked.every((t, i) => t.id === state.ranked[i].id) &&
    queue.every((t, i) => t.id === state.queue[i].id)
  if (unchanged) return state

  // The binary-search window pointed into the old ranking - the song being placed starts over with a fresh keep/skip.
  return {
    ...state,
    allTracks: [...processed, ...queue],
    queue,
    ranked,
    skippedCount: processed.length - ranked.length,
    pendingDecision: queue.length > 0,
    lo: 0,
    hi: 0,
  }
}
