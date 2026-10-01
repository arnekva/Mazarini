import "./summer.css"
import { Clouds } from "../shared/Clouds"

/** One strip of waves: a repeating wave shape twice the screen's width, slid sideways forever (see .sumWave). */
function Wave({ className }: { className: string }) {
  const crests = 8
  let d = "M 0 10"
  for (let i = 0; i < crests; i++) d += ` q 12.5 -10 25 0 q 12.5 10 25 0`
  d += ` V 40 H 0 Z`
  return (
    <svg className={`sumWave ${className}`} viewBox={`0 0 ${crests * 50} 40`} preserveAspectRatio="none">
      <path d={d} fill="currentColor" />
    </svg>
  )
}

export function SummerDecor() {
  return (
    <div data-theme-decor="summer">
      <div className="sumSun">
        <div className="sumRays" />
      </div>
      <Clouds />
      {[1, 2].map((n) => (
        <svg key={n} className={`sumGull sumGull${n}`} viewBox="0 0 24 10">
          <path d="M 1 7 Q 6 1 12 7 Q 18 1 23 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ))}
      <div className="sumSea">
        <Wave className="sumWaveBack" />
        <Wave className="sumWaveFront" />
      </div>
      <div className="sumSand" />
      <span className="sumBeach sumUmbrella">⛱️</span>
      <span className="sumBeach sumMelon">🍉</span>
      <span className="sumBeach sumShades">😎</span>
      <span className="sumBeach sumCrab">🦀</span>
    </div>
  )
}
