"use client"

import { WheelSector } from "@/lib/wheelGeometry"
import styles from "./SpinWheel.module.css"

/** Slice colours from the smallest chip prize to the biggest: cool and calm at the bottom, hot and golden at the top - so how good
 * a slice is shows before you've read it. [deep, bright] - each slice is a gradient from one to the other. */
const TIERS: [string, string][] = [
  ["#1d4ed8", "#60a5fa"],
  ["#0f766e", "#2dd4bf"],
  ["#15803d", "#4ade80"],
  ["#6d28d9", "#a78bfa"],
  ["#be185d", "#f472b6"],
  ["#c2410c", "#fb923c"],
  ["#b91c1c", "#f87171"],
  ["#a16207", "#fde047"],
]
/** Anything that isn't chips (a loot chest, shards...) - the special one: near-black with a gold label. */
const SPECIAL: [string, string] = ["#0f0a1e", "#3b2a63"]

const ICONS: Record<string, string> = { chest: "🎁", box: "📦", shards: "💎", pack: "🃏", dond: "💼" }

const BULBS = 24

function chipAmount(sector: WheelSector): number | undefined {
  const match = sector.name.match(/^(\d+)\s*chips?$/i)
  return match ? Number(match[1]) : undefined
}

/** The wheel's own short text for a slice (results and messages still use the full name): "5k" rather than "5000 chips", and an
 * icon for the prizes that aren't chips. Everything from 1000 up in k, so 2500 is "2.5k" next to the "2k" and "3k" around it. */
function shortLabel(sector: WheelSector): string {
  const amount = chipAmount(sector)
  if (amount === undefined) return ICONS[sector.type] ?? (sector.type.startsWith("effect") ? "✨" : sector.name)
  return amount >= 1000 ? `${amount / 1000}k` : String(amount)
}

/** Which colour each slice gets: chip prizes by how big they are among the wheel's chip prizes, everything else the special one. */
function sliceColors(sectors: WheelSector[]): [string, string][] {
  const amounts = [...new Set(sectors.map(chipAmount).filter((a): a is number => a !== undefined))].sort((a, b) => a - b)
  return sectors.map((s) => {
    const amount = chipAmount(s)
    if (amount === undefined) return SPECIAL
    const rank = amounts.length > 1 ? amounts.indexOf(amount) / (amounts.length - 1) : 1
    return TIERS[Math.round(rank * (TIERS.length - 1))]
  })
}

/** A point on the wheel `r` out from the centre, `deg` clockwise from the top - in the -100..100 space the wheel is drawn in. */
const at = (r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180
  return `${(r * Math.sin(rad)).toFixed(3)} ${(-r * Math.cos(rad)).toFixed(3)}`
}

function wedge(r: number, fromDeg: number, toDeg: number) {
  const large = toDeg - fromDeg > 180 ? 1 : 0
  return `M 0 0 L ${at(r, fromDeg)} A ${r} ${r} 0 ${large} 1 ${at(r, toDeg)} Z`
}

const sliceDegs = (s: WheelSector) => [(s.startPct / 100) * 360, (s.endPct / 100) * 360] as const

/** The slice under the pointer at this rotation - when it changes, a divider has just passed the pointer and it gets flicked. */
function sectorUnderPointer(sectors: WheelSector[], rotation: number) {
  const deg = (((-rotation % 360) + 360) % 360) / 3.6
  return sectors.findIndex((s) => deg >= s.startPct && deg < s.endPct)
}

interface SpinWheelProps {
  sectors: WheelSector[]
  rotation: number
  /** Index into `sectors` to glow (the just-landed winner) once the spin finishes, or null for none. */
  highlightIndex?: number | null
  /** The rim bulbs chase round while it spins, and just twinkle while it's still. */
  spinning?: boolean
}

export function SpinWheel({ sectors, rotation, highlightIndex, spinning }: SpinWheelProps) {
  const colors = sliceColors(sectors)
  const highlighted = highlightIndex != null ? sectors[highlightIndex] : undefined

  return (
    <div className={`${styles.wheelWrap} ${spinning ? styles.spinning : ""}`}>
      <div className={styles.frame}>
        <div className={styles.innerRing}>
          <svg className={styles.wheel} viewBox="-100 -100 200 200" style={{ transform: `rotate(${rotation}deg)` }}>
            <defs>
              {colors.map(([deep, bright], i) => (
                <radialGradient key={i} id={`slice${i}`} cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
                  <stop offset="0.15" stopColor={deep} />
                  <stop offset="0.75" stopColor={bright} />
                  <stop offset="1" stopColor={deep} />
                </radialGradient>
              ))}
              <linearGradient id="divider" x1="0" y1="0" x2="0" y2="-100" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#7a5b12" />
                <stop offset="1" stopColor="#f4d78c" />
              </linearGradient>
            </defs>

            {sectors.map((s, i) => {
              const [from, to] = sliceDegs(s)
              return <path key={i} d={wedge(100, from, to)} fill={`url(#slice${i})`} />
            })}

            {/* The special prizes get a gold outline - however thin the slice, it reads as a jackpot slot, not a crack. */}
            {sectors.map((s, i) =>
              colors[i] === SPECIAL ? <path key={`s${i}`} className={styles.specialEdge} d={wedge(100, ...sliceDegs(s))} /> : null
            )}

            {sectors.map((s, i) => {
              const [from] = sliceDegs(s)
              return <path key={`d${i}`} d={`M 0 0 L ${at(100, from)}`} stroke="url(#divider)" strokeWidth="1.1" />
            })}
            <circle r="99" fill="none" stroke="#f4d78c" strokeWidth="1.2" opacity="0.8" />

            {sectors.map((s, i) => {
              const [from, to] = sliceDegs(s)
              const label = shortLabel(s)
              const special = colors[i] === SPECIAL
              // As big as the slice's width allows at the label's distance from the centre, capped so wide slices don't shout.
              const chord = 2 * 64 * Math.sin(((to - from) * Math.PI) / 360)
              const fontSize = Math.max(5, Math.min(special ? 15 : 13, chord * 0.62, 70 / Math.max(label.length, 1)))
              return (
                <text
                  key={`l${i}`}
                  className={special ? `${styles.label} ${styles.labelSpecial}` : styles.label}
                  // Along the slice: outwards from the hub on the right half, inwards on the left - so none of it is upside down.
                  transform={`rotate(${s.midDeg}) translate(0 -62) rotate(${s.midDeg > 180 ? 90 : -90})`}
                  fontSize={fontSize}
                >
                  {label}
                </text>
              )
            })}

            {highlighted && <path className={styles.highlight} d={wedge(100, ...sliceDegs(highlighted))} />}
          </svg>
          <div className={styles.gloss} />
        </div>
      </div>

      {/* What doesn't turn: the bulbs round the rim, the hub and the pointer. */}
      <svg className={styles.overlay} viewBox="-100 -100 200 200">
        <defs>
          <radialGradient id="hubGold" cx="-0.3" cy="-0.35" r="1.2">
            <stop offset="0" stopColor="#fff4c4" />
            <stop offset="0.45" stopColor="#e6b93a" />
            <stop offset="1" stopColor="#6b4a0c" />
          </radialGradient>
          <linearGradient id="pointerGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8a6414" />
            <stop offset="0.5" stopColor="#ffe9a3" />
            <stop offset="1" stopColor="#8a6414" />
          </linearGradient>
        </defs>

        {Array.from({ length: BULBS }, (_, i) => {
          const deg = (360 / BULBS) * i
          const [x, y] = at(95.3, deg).split(" ")
          return <circle key={i} className={styles.bulb} cx={x} cy={y} r="2.3" style={{ animationDelay: `${(i % 2) * 0.6 + (spinning ? (i / BULBS) * 0.6 : 0)}s` }} />
        })}

        <circle r="12" fill="url(#hubGold)" stroke="#3d2c07" strokeWidth="1.2" />
        <circle r="7.5" fill="#1a1205" opacity="0.85" />
        <text className={styles.hubStar} y="3.2" fontSize="10">
          ★
        </text>

        <g key={sectorUnderPointer(sectors, rotation)} className={styles.pointer}>
          <path d="M -9 -104 L 9 -104 L 9 -98 L 0 -80 L -9 -98 Z" fill="url(#pointerGold)" stroke="#3d2c07" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cy="-98" r="3.6" fill="#e11d48" stroke="#ffe4ea" strokeWidth="0.8" />
        </g>
      </svg>
    </div>
  )
}
