"use client"

import { useCallback, useEffect, useRef } from "react"

/** How often to poll while the Activity isn't on screen - rarely, but still often enough to count as present at a table
 * (the tables drop anyone who's been quiet for 20-60 seconds). */
const HIDDEN_POLL_MS = 5000

/**
 * Calls `poll` over and over for as long as `key` is set, restarting when `key` changes. The next call is scheduled when the
 * previous one has answered, so a slow answer can never pile up behind or overtake the next. Backs off while the page is
 * hidden and polls at once when it's shown again.
 *
 * `delayMs` can be a function, for a rate that depends on something the loop shouldn't restart for. With `immediate` the
 * first call happens right away instead of after one delay.
 *
 * Returns a function that polls right now instead of waiting for the next turn (see useLivePolling). If a poll is already on its
 * way its answer may be from before whatever prompted the call, so another one follows when it's back - but only if
 * `stillNeeded` says so at that point (it isn't asked for a call made with `force`).
 */
export function usePolling(
  key: string | null,
  poll: () => Promise<unknown>,
  delayMs: number | (() => number),
  immediate = false,
  stillNeeded?: () => boolean
): (force?: boolean) => void {
  const pollRef = useRef(poll)
  const delayRef = useRef(delayMs)
  const stillNeededRef = useRef(stillNeeded)
  const pollNowRef = useRef<(force?: boolean) => void>(() => {})
  useEffect(() => {
    pollRef.current = poll
    delayRef.current = delayMs
    stillNeededRef.current = stillNeeded
  })

  useEffect(() => {
    if (key === null) return
    let cancelled = false
    let running = false
    let again = false
    let forced = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const nextDelay = () => {
      const delay = typeof delayRef.current === "function" ? delayRef.current() : delayRef.current
      return document.hidden ? Math.max(delay, HIDDEN_POLL_MS) : delay
    }
    const tick = async () => {
      running = true
      let repeat = false
      do {
        again = false
        forced = false
        try {
          await pollRef.current()
        } catch {
          // transient poll failure - next tick retries
        }
        repeat = again && (forced || (stillNeededRef.current?.() ?? true))
      } while (repeat && !cancelled)
      running = false
      if (!cancelled) timer = setTimeout(tick, nextDelay())
    }
    const onVisibilityChange = () => {
      if (document.hidden || running || cancelled) return
      clearTimeout(timer)
      tick()
    }

    pollNowRef.current = (force = false) => {
      if (running) {
        again = true
        forced ||= force
        return
      }
      clearTimeout(timer)
      tick()
    }

    timer = setTimeout(tick, immediate ? 0 : nextDelay())
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      cancelled = true
      pollNowRef.current = () => {}
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [key, immediate])

  return useCallback((force?: boolean) => pollNowRef.current(force), [])
}
