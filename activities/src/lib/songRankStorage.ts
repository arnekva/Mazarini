import { RankState } from "./songRanker"

// Per-viewer convenience only (this browser, this device) - not shared state, just resilience
// against a closed tab / crashed page mid-ranking on a 1000+ track playlist.
// Bumped when RankState's shape changes, so a stale save from an old shape doesn't get force-fed
// into the new state machine - it just quietly stops resuming instead of crashing.
const KEY = "songRank:v2"

export function saveProgress(state: RankState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (private mode, quota, etc.) - progress just won't resume, non-fatal
  }
}

export function loadProgress(): RankState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RankState) : null
  } catch {
    return null
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
