export interface WheelReward {
  name: string
  weight: number
  type: string
}

export interface WheelSector extends WheelReward {
  startPct: number
  endPct: number
  midDeg: number
}

export function layoutSectors(rewards: WheelReward[]): WheelSector[] {
  const total = rewards.reduce((sum, r) => sum + r.weight, 0)
  let cumulative = 0
  return rewards.map((r) => {
    const startPct = (cumulative / total) * 100
    cumulative += r.weight
    const endPct = (cumulative / total) * 100
    const midDeg = ((startPct + endPct) / 2 / 100) * 360
    return { ...r, startPct, endPct, midDeg }
  })
}

export function conicGradient(sectors: WheelSector[], colors: string[]): string {
  const stops = sectors.map((s, i) => `${colors[i % colors.length]} ${s.startPct}% ${s.endPct}%`).join(", ")
  return `conic-gradient(from 0deg, ${stops})`
}

/** Rotation (deg) needed to bring `targetMidDeg`'s sector under a pointer fixed at the top (0deg),
 * always spinning forward from `currentRotation` by at least `extraSpins` full turns for the visual. */
export function rotationForTarget(currentRotation: number, targetMidDeg: number, extraSpins = 6): number {
  const targetMod = (((360 - targetMidDeg) % 360) + 360) % 360
  const currentMod = ((currentRotation % 360) + 360) % 360
  const delta = ((targetMod - currentMod) + 360) % 360
  return currentRotation + extraSpins * 360 + delta
}
