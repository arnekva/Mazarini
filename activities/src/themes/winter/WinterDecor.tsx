import "./winter.css"
import { Falling } from "../shared/Falling"

export function WinterDecor() {
  return (
    <div data-theme-decor="winter">
      <div className="wntAurora" />
      <div className="wntFrost" />
      <Falling items={[""]} count={50} seed={47} size={[5, 15]} duration={[10, 20]} drift={50} opacity={[0.35, 0.9]} />
      <Falling items={["❄"]} count={7} seed={48} size={[14, 22]} duration={[14, 22]} drift={60} spin={180} opacity={[0.4, 0.7]} />
      <div className="wntDrift" />
    </div>
  )
}
