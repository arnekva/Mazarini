import "./hangover.css"
import { seeded } from "../shared/Falling"

const CONFETTI_COLORS = ["#8a7f5a", "#6f7d8f", "#8a6566", "#6d8466", "#7b6f8f"]

/** What's left of last night: confetti trodden into the floor. */
function OldConfetti() {
  const rnd = seeded(101)
  return (
    <>
      {Array.from({ length: 46 }, (_, i) => {
        const style = {
          left: `${(rnd() * 100).toFixed(1)}%`,
          bottom: `${(rnd() * 46).toFixed(0)}px`,
          transform: `rotate(${(rnd() * 360).toFixed(0)}deg)`,
          background: CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)],
        }
        return <span key={i} className="hngConfetti" style={style} />
      })}
    </>
  )
}

export function HangoverDecor() {
  return (
    <div data-theme-decor="hangover">
      <div className="hngThrob" />
      <span className="hngFace">😵‍💫</span>
      <span className="hngZ hngZ1">z</span>
      <span className="hngZ hngZ2">z</span>
      <span className="hngZ hngZ3">Z</span>
      <OldConfetti />
      <span className="hngWater">🥛</span>
      <span className="hngPill">💊</span>
      <span className="hngGlasses">🕶️</span>
    </div>
  )
}
