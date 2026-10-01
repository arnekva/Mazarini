import "./earlysummer.css"
import { Clouds } from "../shared/Clouds"

export function EarlySummerDecor() {
  return (
    <div data-theme-decor="earlysummer">
      <div className="themeSun esSun" />
      <div className="esHaze" />
      <Clouds />
      <span className="esButterfly esButterfly1">🦋</span>
      <span className="esButterfly esButterfly2">🦋</span>
      <span className="esButterfly esButterfly3">🐝</span>
      <div className="esGrass" />
      <span className="esBerry esBerry1">🍓</span>
      <span className="esBerry esBerry2">🍓</span>
      <span className="esBerry esBerry3">🌼</span>
      <span className="esBerry esBerry4">🌻</span>
    </div>
  )
}
