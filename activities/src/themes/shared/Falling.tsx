/** Small seeded random generator - the same particles on every render. */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface FallingProps {
  /** What falls - picked at random per particle. An empty string is a plain shape instead (see `shape`). */
  items: string[]
  count: number
  seed?: number
  size: [number, number]
  /** Seconds to fall the height of the screen. */
  duration: [number, number]
  /** Max sideways sway in px, either way. */
  drift?: number
  /** Max rotation over one fall, in degrees. */
  spin?: number
  opacity?: [number, number]
  /** For the plain shapes: a round snowflake, or a paper confetti strip. */
  shape?: "flake" | "confetti"
  /** Colours for the plain shapes, picked at random per particle - default white. */
  colors?: string[]
}

/** Things falling down the screen (leaves, snow...) - plain CSS animation, see shared.css. Start times are spread out so the screen
 * is already full the moment the page shows. */
export function Falling({ items, count, seed = 1, size, duration, drift = 60, spin = 0, opacity = [0.5, 0.9], shape = "flake", colors }: FallingProps) {
  const rnd = seeded(seed)
  const between = ([min, max]: [number, number]) => min + rnd() * (max - min)

  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const item = items[Math.floor(rnd() * items.length)]
        const dur = between(duration)
        const style = {
          "--x": `${(rnd() * 100).toFixed(1)}%`,
          "--size": `${between(size).toFixed(0)}px`,
          "--dur": `${dur.toFixed(1)}s`,
          "--delay": `${(-rnd() * dur).toFixed(1)}s`,
          "--drift": `${((rnd() * 2 - 1) * drift).toFixed(0)}px`,
          "--spin": `${((rnd() * 2 - 1) * spin).toFixed(0)}deg`,
          "--o": between(opacity).toFixed(2),
          ...(colors ? { "--color": colors[Math.floor(rnd() * colors.length)] } : {}),
        } as React.CSSProperties
        return (
          <span key={i} className={item ? "themeFall" : `themeFall ${shape === "confetti" ? "themeConfetti" : "themeFlake"}`} style={style}>
            {item}
          </span>
        )
      })}
    </>
  )
}
