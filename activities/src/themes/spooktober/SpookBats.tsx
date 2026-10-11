"use client"

import { CSSProperties, useEffect, useState } from "react"

/** How many bats are out on a given day of October. The three that have always been there stay until day 5, then a bat is added every
 * few days - barely enough to notice - up to 5 on the 14th. From the 15th it speeds up (quadratically) to a swarm of 60 on the 31st. */
export const BASE_BATS = 3
export const SWARM_BATS = 60

export function batsForDay(day: number): number {
  const d = Math.min(31, Math.max(1, Math.round(day)))
  if (d <= 14) return Math.round(BASE_BATS + (2 * (d - 1)) / 13)
  const t = (d - 14) / 17
  return Math.round(5 + (SWARM_BATS - 5) * t * t)
}

/** 0-1 from an index, the same on the server and the client (a real random number would make the two renders disagree). */
const spread = (i: number, salt: number) => (((i + 1) * 0.6180339887 * salt) % 1 + 1) % 1

function batStyle(i: number): CSSProperties {
  const duration = 18 + spread(i, 1.7) * 18 // 18-36s
  return {
    top: `${4 + spread(i, 2.3) * 84}%`,
    fontSize: `${14 + Math.round(spread(i, 3.1) * 14)}px`,
    animationDuration: `${duration.toFixed(1)}s`,
    // Negative: already somewhere along the way when the page opens, instead of everyone starting off-screen on the left.
    animationDelay: `-${(spread(i, 4.9) * duration).toFixed(1)}s`,
    animationName: i % 2 === 0 ? "spkBatFly" : "spkBatFlyBack",
  }
}

/** The first three are the original bats (position and timing from the stylesheet); every one after them is placed by `batStyle`. */
export function SpookBats({ day }: { day: number }) {
  const [shownDay, setShownDay] = useState(day)

  // ?batDay=<1-31> previews any day of the build-up, out of season too. Kept for the session, like ?theme=.
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("batDay")
      if (fromUrl === "auto") sessionStorage.removeItem("batDay")
      else if (fromUrl && Number.isFinite(Number(fromUrl))) sessionStorage.setItem("batDay", fromUrl)
      const override = sessionStorage.getItem("batDay")
      if (override && Number.isFinite(Number(override))) setShownDay(Number(override))
    } catch {
      // No sessionStorage - stay on today's.
    }
  }, [])

  const count = batsForDay(shownDay)
  return (
    <>
      {Array.from({ length: count }, (_, i) =>
        i < BASE_BATS ? (
          <span key={i} className={`spkBat spkBat${i + 1}`}>
            🦇
          </span>
        ) : (
          <span key={i} className="spkBat" style={batStyle(i)}>
            🦇
          </span>
        )
      )}
    </>
  )
}
