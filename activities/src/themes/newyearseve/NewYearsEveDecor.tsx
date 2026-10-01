import "./newyearseve.css"
import { Falling } from "../shared/Falling"

const SPARKS = 14
const BURSTS = [
  { x: "12%", y: "16%", color: "#f3cf6b", delay: 0 },
  { x: "86%", y: "12%", color: "#fb7185", delay: 1.4 },
  { x: "74%", y: "42%", color: "#5eead4", delay: 2.6 },
  { x: "20%", y: "55%", color: "#a78bfa", delay: 3.5 },
  { x: "50%", y: "8%", color: "#60a5fa", delay: 4.6 },
]

/** One firework: sparks flying out from a point in every direction, fading as they go. */
function Burst({ x, y, color, delay }: (typeof BURSTS)[number]) {
  return (
    <div className="nyeBurst" style={{ left: x, top: y, "--c": color, "--d": `${delay}s` } as React.CSSProperties}>
      {Array.from({ length: SPARKS }, (_, i) => (
        <span key={i} className="nyeSpark" style={{ "--a": `${(360 / SPARKS) * i}deg` } as React.CSSProperties} />
      ))}
    </div>
  )
}

export function NewYearsEveDecor() {
  return (
    <div data-theme-decor="newyearseve">
      {BURSTS.map((b, i) => (
        <Burst key={i} {...b} />
      ))}
      <Falling items={["✨", ""]} count={14} seed={31} size={[8, 16]} duration={[10, 18]} drift={30} opacity={[0.3, 0.7]} />
      <span className="nyeChampagne">🍾</span>
      <span className="nyeGlasses">🥂</span>
    </div>
  )
}
