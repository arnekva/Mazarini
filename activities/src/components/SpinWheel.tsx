"use client"

import { conicGradient, WheelSector } from "@/lib/wheelGeometry"
import styles from "./SpinWheel.module.css"

const SECTOR_COLORS = ["var(--gold)", "var(--purple)", "var(--blue)", "var(--green)", "var(--red)", "var(--teal)"]
const LABEL_RADIUS = 88

export function SpinWheel({ sectors, rotation }: { sectors: WheelSector[]; rotation: number }) {
  return (
    <div className={styles.wheelWrap}>
      <div className={styles.pointer} />
      <div className={styles.wheel} style={{ background: conicGradient(sectors, SECTOR_COLORS), transform: `rotate(${rotation}deg)` }}>
        {sectors.map((s, i) => {
          const angleRad = (s.midDeg * Math.PI) / 180
          const x = LABEL_RADIUS * Math.sin(angleRad)
          const y = -LABEL_RADIUS * Math.cos(angleRad)
          return (
            <span key={i} className={styles.label} style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}>
              {s.name}
            </span>
          )
        })}
      </div>
      <div className={styles.hub} />
    </div>
  )
}
