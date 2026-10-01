import "./autumn.css"
import { Falling } from "../shared/Falling"

export function AutumnDecor() {
  return (
    <div data-theme-decor="autumn">
      <div className="autSun" />
      <Falling items={["🍂", "🍁", "🍂"]} count={16} seed={11} size={[16, 28]} duration={[12, 20]} drift={90} spin={540} opacity={[0.5, 0.85]} />
      <div className="autHaze" />
    </div>
  )
}
