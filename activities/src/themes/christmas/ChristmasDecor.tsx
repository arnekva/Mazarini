import "./christmas.css"
import { Falling } from "../shared/Falling"

const SWAGS = 3
const SAG = 26
const BULBS = 19
const COLORS = ["#ff4d4d", "#ffd34d", "#4dd97a", "#4db8ff", "#ff7ad9"]

/** How far down the wire hangs at x (0-1 across the screen): three swags, each hanging lowest in its middle. */
const wireY = (x: number) => 4 + SAG * Math.sin(Math.PI * ((x * SWAGS) % 1))

/** A string of fairy lights hung in swags across the top of the screen. */
function Lights() {
  // Traced from the same curve the bulbs sit on, in px down (the box is 70px tall) by % across.
  const wire = "M " + Array.from({ length: 151 }, (_, i) => `${((i / 150) * 100).toFixed(2)} ${wireY(i / 150).toFixed(1)}`).join(" L ")

  return (
    <div className="xmasLights">
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" className="xmasWire">
        <path d={wire} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: BULBS }, (_, i) => {
        const x = (i + 0.5) / BULBS
        const style = {
          left: `${(x * 100).toFixed(2)}%`,
          top: `${wireY(x).toFixed(1)}px`,
          "--bulb": COLORS[i % COLORS.length],
          animationDelay: `${(i % 3) * 0.6}s`,
        } as React.CSSProperties
        return <span key={i} className="xmasBulb" style={style} />
      })}
    </div>
  )
}

export function ChristmasDecor() {
  return (
    <div data-theme-decor="christmas">
      <Lights />
      <Falling items={[""]} count={40} seed={25} size={[6, 15]} duration={[9, 17]} drift={40} opacity={[0.4, 0.9]} />
      <div className="xmasGround" />
      <span className="xmasTree">🎄</span>
      <span className="xmasGift">🎁</span>
    </div>
  )
}
