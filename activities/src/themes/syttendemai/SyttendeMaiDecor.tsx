import "./syttendemai.css"
import { Clouds } from "../shared/Clouds"
import { Falling } from "../shared/Falling"

const RED = "#ba0c2f"
const WHITE = "#ffffff"
const BLUE = "#00205b"

/** The Norwegian flag, drawn - flag emoji don't show on Windows (they come out as the letters "NO"). 22:16, as the real one. */
export function NorwegianFlag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 22 16">
      <rect width="22" height="16" fill={RED} />
      <rect x="6" width="4" height="16" fill={WHITE} />
      <rect y="6" width="22" height="4" fill={WHITE} />
      <rect x="7" width="2" height="16" fill={BLUE} />
      <rect y="7" width="22" height="2" fill={BLUE} />
    </svg>
  )
}

const SWAGS = 3
const SAG = 22
const PENNANTS = 24
const PENNANT_COLORS = [RED, WHITE, BLUE]
const swagY = (x: number) => 2 + SAG * Math.sin(Math.PI * ((x * SWAGS) % 1))

/** Bunting in the flag's colours, hung in swags across the top. */
function Bunting() {
  const line = "M " + Array.from({ length: 151 }, (_, i) => `${((i / 150) * 100).toFixed(2)} ${swagY(i / 150).toFixed(1)}`).join(" L ")
  return (
    <div className="smBunting">
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="smLine">
        <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: PENNANTS }, (_, i) => {
        const x = (i + 0.5) / PENNANTS
        // Tilted to follow the line: its slope at x, in degrees.
        const slope = (swagY(x + 0.002) - swagY(x - 0.002)) / 0.004
        const style = {
          left: `${(x * 100).toFixed(2)}%`,
          top: `${swagY(x).toFixed(1)}px`,
          "--pennant": PENNANT_COLORS[i % PENNANT_COLORS.length],
          "--tilt": `${((Math.atan2(slope, 1000) * 180) / Math.PI).toFixed(1)}deg`,
          animationDelay: `${(i % 4) * -0.5}s`,
        } as React.CSSProperties
        return <span key={i} className="smPennant" style={style} />
      })}
    </div>
  )
}

export function SyttendeMaiDecor() {
  return (
    <div data-theme-decor="syttendemai">
      <div className="themeSun smSun" />
      <Clouds />
      <Bunting />
      <Falling items={[""]} count={40} seed={517} size={[18, 28]} duration={[8, 15]} drift={60} spin={720} opacity={[0.6, 0.95]} shape="confetti" colors={[RED, WHITE, BLUE, RED]} />
      <span className="smFlagPole smFlagLeft">
        <NorwegianFlag className="smFlag" />
      </span>
      <span className="smFlagPole smFlagRight">
        <NorwegianFlag className="smFlag" />
      </span>
      <span className="smTreat smTreat1">🌭</span>
      <span className="smTreat smTreat2">🍦</span>
    </div>
  )
}
