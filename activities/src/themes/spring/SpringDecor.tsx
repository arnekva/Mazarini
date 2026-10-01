import "./spring.css"
import { Clouds } from "../shared/Clouds"
import { Falling } from "../shared/Falling"

export function SpringDecor() {
  return (
    <div data-theme-decor="spring">
      <div className="themeSun sprSun" />
      <Clouds />
      <Falling items={["🌸", "🌸", "", ""]} count={18} seed={61} size={[12, 22]} duration={[14, 24]} drift={110} spin={360} opacity={[0.7, 1]} shape="confetti" colors={["#f7a1c4", "#fbc4da", "#f080ae"]} />
      <div className="sprMeadow" />
      <span className="sprFlower sprFlower1">🌷</span>
      <span className="sprFlower sprFlower2">🌼</span>
      <span className="sprFlower sprFlower3">🌱</span>
      <span className="sprFlower sprFlower4">🌷</span>
    </div>
  )
}
