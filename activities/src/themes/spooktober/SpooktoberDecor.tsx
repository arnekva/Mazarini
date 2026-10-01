import "./spooktober.css"
/** A cobweb drawn from the top-left corner: spokes fanning out, joined by threads that sag towards the corner between each pair. */
function Cobweb() {
  const angles = [0, 15, 30, 45, 60, 75, 90].map((deg) => (deg * Math.PI) / 180)
  const spokeLength = 170
  const rings = [28, 58, 92, 130]
  const at = (r: number, a: number) => [r * Math.cos(a), r * Math.sin(a)].map((n) => n.toFixed(1)).join(" ")

  const threads = rings.map((r) => {
    let d = `M ${at(r, angles[0])}`
    for (let i = 1; i < angles.length; i++) d += ` Q ${at(r * 0.82, (angles[i - 1] + angles[i]) / 2)} ${at(r, angles[i])}`
    return d
  })

  return (
    <svg className="spkWeb" viewBox="0 0 170 170" fill="none" stroke="currentColor" strokeLinecap="round">
      {angles.map((a, i) => (
        <path key={`s${i}`} d={`M 0 0 L ${at(spokeLength, a)}`} strokeWidth="0.9" />
      ))}
      {threads.map((d, i) => (
        <path key={`t${i}`} d={d} strokeWidth="0.7" />
      ))}
      {/* the spider, hanging off the outer ring */}
      <path d={`M ${at(92, angles[3])} L ${at(92, angles[3]).split(" ")[0]} 150`} strokeWidth="0.6" />
      <circle cx={at(92, angles[3]).split(" ")[0]} cy="154" r="4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SpooktoberDecor() {
  return (
    <div data-theme-decor="spooktober">
      <div className="spkMoon" />
      <Cobweb />
      <span className="spkBat spkBat1">🦇</span>
      <span className="spkBat spkBat2">🦇</span>
      <span className="spkBat spkBat3">🦇</span>
      <span className="spkGhost spkGhost1">👻</span>
      <span className="spkGhost spkGhost2">👻</span>
      <div className="spkFog" />
      <span className="spkPumpkin spkPumpkinLeft">🎃</span>
      <span className="spkPumpkin spkPumpkinRight">🎃</span>
    </div>
  )
}
