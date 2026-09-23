"use client"

import { conicGradient, WheelSector } from "@/lib/wheelGeometry"
import styles from "./SpinWheel.module.css"

const SECTOR_COLORS = ["var(--gold)", "var(--purple)", "var(--blue)", "var(--green)", "var(--red)", "var(--teal)"]
const LABEL_RADIUS = 96

// The real reward table has up to 16 slices, most of them "N chips" - spelling out "chips" on every
// single one (repeated ~10 times) is pure noise squeezed into a 260px circle. Abbreviate just the
// wheel's own label text (not reward.name itself, which is still used as-is for results/messages).
function shortLabel(name: string): string {
  const match = name.match(/^(\d+)\s*chips?$/i)
  if (!match) return name
  const amount = Number(match[1])
  return amount % 1000 === 0 ? `${amount / 1000}k` : amount.toLocaleString("no-NO")
}

interface SpinWheelProps {
  sectors: WheelSector[]
  rotation: number
  /** Index into `sectors` to glow (the just-landed winner) once the spin finishes, or null for none. */
  highlightIndex?: number | null
}

export function SpinWheel({ sectors, rotation, highlightIndex }: SpinWheelProps) {
  const highlighted = highlightIndex != null ? sectors[highlightIndex] : undefined

  return (
    <div className={styles.wheelWrap}>
      <div className={styles.pointer} />
      <div className={styles.frame}>
        <div className={styles.innerRing}>
          <div className={styles.wheel} style={{ background: conicGradient(sectors, SECTOR_COLORS), transform: `rotate(${rotation}deg)` }}>
            {sectors.map((s, i) => {
              // A slice like "Loot chest" at weight 1 of 114 is only ~3deg wide - even the shortened
              // label needs a smaller font there than a 30deg "500 chips" slice gets, same idea as
              // the old canvas wheel's weight-based font-size split (14px vs 18px), just continuous.
              const sectorDeg = ((s.endPct - s.startPct) / 100) * 360
              const fontSize = Math.max(7, Math.min(11, sectorDeg * 0.85))
              return (
                // Rotated to run radially along the wedge (like the old canvas wheel's ctx.rotate()
                // text) instead of staying horizontal - with 16 real reward slices, horizontal labels
                // packed this tight collide with their neighbors; radial text only has to fit the
                // slice's own width, not its neighbors'.
                <span
                  key={i}
                  className={styles.label}
                  style={{ fontSize, transform: `rotate(${s.midDeg}deg) translateY(-${LABEL_RADIUS}px) translateX(-50%)` }}
                >
                  {shortLabel(s.name)}
                </span>
              )
            })}
            {highlighted && (
              <div
                className={styles.highlight}
                style={{
                  background: `conic-gradient(from 0deg, transparent 0% ${highlighted.startPct}%, rgba(244, 215, 140, 0.65) ${highlighted.startPct}% ${highlighted.endPct}%, transparent ${highlighted.endPct}% 100%)`,
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className={styles.hub} />
    </div>
  )
}
