"use client"

import { useCallback, useEffect, useRef } from "react"
import { callApi } from "./apiClient"
import { usePolling } from "./usePolling"

// Push, on top of the polling: the browser listens to a few small spots in the database and asks our own API for the table again
// the moment one of them shows something the page doesn't have yet. The API stays the only thing that knows the rules and builds
// the view - this is just the doorbell that replaces waiting for the next poll.
//
// It's built to not ask for anything it already has: every view carries a version, the database tells us the current one, and a
// request only goes out when the two differ. So your own action (whose answer is already on screen) costs nothing extra, a change
// by someone else costs everyone else one request, and an idle table costs a poll every LIVE_POLL_MS - the heartbeat that keeps
// you at the table. If the connection can't be made (or drops) nothing breaks: polling carries on at its normal rate.

/** Something in the database (below the dev/prod root) to watch:
 *  - a plain path: any change to it is news
 *  - `path` + `shown`: news only when its value isn't the one the page is showing (`empty` = what a missing value counts as)
 *  - `tail` + `shownAt`: a chat - news only when its newest message isn't the newest one the page is showing */
export type LivePath = string | { path: string; shown: () => unknown; empty?: unknown } | { tail: string; shownAt: () => number | undefined }

const pathOf = (p: LivePath) => (typeof p === "string" ? p : "tail" in p ? p.tail : p.path)

type DatabaseApi = typeof import("firebase/database")
interface Live {
  api: DatabaseApi
  db: import("firebase/database").Database
  /** The top-level node everything lives under ("dev" or "prod"). */
  root: string
}

let connection: Promise<Live> | null = null

function connect(accessToken: string): Promise<Live> {
  connection ??= open(accessToken).catch((e) => {
    connection = null
    throw e
  })
  return connection
}

async function open(accessToken: string): Promise<Live> {
  const config = await callApi<{ firebase: Record<string, string>; database: string }>("/api/live-config", accessToken)

  // Inside Discord nothing may be reached directly - only through the Activity's own URL mappings. This sends the database's
  // websocket through the mapping "/firebase/{shard}" -> "{shard}.<database domain>" (Developer Portal > URL Mappings); {shard}
  // because the database hands the connection over to a differently named host of the same domain after the first hello.
  // Has to happen before firebase/database is loaded below: it picks up the global WebSocket when it's imported.
  if (window.location.hostname.endsWith(".discordsays.com")) {
    const { patchUrlMappings } = await import("@discord/embedded-app-sdk")
    const host = new URL(config.firebase.databaseURL).hostname
    patchUrlMappings([{ prefix: "/.proxy/firebase/{shard}", target: host.replace(/^[^.]+/, "{shard}") }], { patchFetch: false, patchXhr: false })
  }

  const [{ initializeApp }, api] = await Promise.all([import("firebase/app"), import("firebase/database")])
  // The long-polling fallback loads scripts from the database's host, which Discord would block anyway.
  api.forceWebSockets()
  return { api, db: api.getDatabase(initializeApp(config.firebase, "live")), root: config.database }
}

/** How often to poll while the live connection is up: a safety net, and the heartbeat that keeps you at the table. */
const LIVE_POLL_MS = 10_000

/**
 * A game's whole refresh loop: `poll` runs every `delayMs` (see usePolling), and at once whenever the database shows something at
 * `paths` that the page doesn't have. While the live connection is up the regular polls drop to LIVE_POLL_MS (or `liveDelayMs`,
 * for a game that has to be asked at a particular moment).
 *
 * Returns a function to call after one of the player's own actions has been put on screen: it catches up if anything else
 * happened in the meantime (nothing is asked for while `paused` says an action is in flight - its answer is about to arrive).
 */
export function useLivePolling(options: {
  /** The loop runs while this is set, and restarts when it changes. */
  key: string | null
  accessToken: string | null
  paths: LivePath[]
  poll: () => Promise<unknown>
  delayMs: number | (() => number)
  liveDelayMs?: (max: number) => number
  immediate?: boolean
  paused?: () => boolean
}): () => void {
  const { key, accessToken } = options
  const optionsRef = useRef(options)
  const liveRef = useRef(false)
  /** Per path: what the database last said. `changed` is for plain paths, `value` for the ones that are compared. */
  const newsRef = useRef<({ changed: boolean; value?: unknown } | undefined)[]>([])
  useEffect(() => {
    optionsRef.current = options
  })

  /** Whether the database has something the page doesn't, going by the paths that can tell. */
  const behind = useCallback(
    () =>
      optionsRef.current.paths.some((p, i) => {
        const news = newsRef.current[i]
        if (!news || typeof p === "string") return false
        return news.value !== ("tail" in p ? (p.shownAt() ?? null) : (p.shown() ?? p.empty ?? null))
      }),
    []
  )

  const pollNow = usePolling(
    key,
    options.poll,
    () => {
      const { delayMs, liveDelayMs } = optionsRef.current
      if (liveRef.current) return liveDelayMs?.(LIVE_POLL_MS) ?? LIVE_POLL_MS
      return typeof delayMs === "function" ? delayMs() : delayMs
    },
    options.immediate,
    behind
  )

  const sync = useCallback(() => {
    // Hidden: usePolling catches up the moment the page is shown again.
    if (document.hidden || optionsRef.current.paused?.()) return
    const changed = newsRef.current.filter((news) => news?.changed)
    for (const news of changed) news!.changed = false
    if (changed.length > 0) pollNow(true)
    else if (behind()) pollNow()
  }, [pollNow, behind])

  useEffect(() => {
    if (!accessToken || key === null) return
    let stop: (() => void) | undefined
    let cancelled = false
    connect(accessToken)
      .then(({ api, db }) => {
        if (cancelled) return
        stop = api.onValue(api.ref(db, ".info/connected"), (snapshot) => {
          const up = snapshot.val() === true
          const was = liveRef.current
          liveRef.current = up
          // Lost the connection: back to polling at the normal rate, starting now rather than when the slow timer runs out.
          if (was && !up) pollNow(true)
        })
      })
      .catch((e) => console.warn("Live updates unavailable - polling only", e))
    return () => {
      cancelled = true
      liveRef.current = false
      stop?.()
    }
  }, [accessToken, key, pollNow])

  const pathsKey = JSON.stringify(options.paths.map((p) => (typeof p === "string" ? p : "tail" in p ? `tail:${p.tail}` : `value:${p.path}`)))
  useEffect(() => {
    if (!accessToken || key === null) return
    const stops: (() => void)[] = []
    let cancelled = false
    newsRef.current = []
    connect(accessToken)
      .then(({ api, db, root }) => {
        if (cancelled) return
        optionsRef.current.paths.forEach((p, i) => {
          const location = api.ref(db, `${root}/${pathOf(p)}`)
          const onValue = (snapshot: import("firebase/database").DataSnapshot) => {
            const raw = snapshot.val()
            if (typeof p === "string") {
              // The first event is just the current value - the page has that from its own first poll.
              newsRef.current[i] = { changed: newsRef.current[i] !== undefined }
            } else if ("tail" in p) {
              const newest = raw ? (Object.values(raw)[0] as { at?: number }) : undefined
              newsRef.current[i] = { changed: false, value: newest?.at ?? null }
            } else {
              newsRef.current[i] = { changed: false, value: raw ?? p.empty ?? null }
            }
            sync()
          }
          const ignore = () => {
            // can't listen here - polling covers it
          }
          stops.push(api.onValue(typeof p !== "string" && "tail" in p ? api.query(location, api.limitToLast(1)) : location, onValue, ignore))
        })
      })
      .catch(() => {
        // already reported by the connection effect above
      })
    return () => {
      cancelled = true
      for (const stopListening of stops) stopListening()
    }
  }, [accessToken, key, pathsKey, sync])

  return sync
}
