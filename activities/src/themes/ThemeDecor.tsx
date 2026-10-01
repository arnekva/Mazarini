import { AutumnDecor } from "./autumn/AutumnDecor"
import { BackToWorkDecor } from "./backtowork/BackToWorkDecor"
import { ChristmasDecor } from "./christmas/ChristmasDecor"
import { EarlySummerDecor } from "./earlysummer/EarlySummerDecor"
import { HangoverDecor } from "./hangover/HangoverDecor"
import { NewYearsEveDecor } from "./newyearseve/NewYearsEveDecor"
import { SpooktoberDecor } from "./spooktober/SpooktoberDecor"
import { SpringDecor } from "./spring/SpringDecor"
import { SummerDecor } from "./summer/SummerDecor"
import { SyttendeMaiDecor } from "./syttendemai/SyttendeMaiDecor"
import { WinterDecor } from "./winter/WinterDecor"

/** The decorations of every theme are always in the page, each hidden unless its theme is the one on <html> (every theme's CSS shows
 * its own) - so switching theme, e.g. with ?theme=, needs nothing but the attribute. Sits behind the content and never takes clicks.
 * Each decoration component also imports its theme's CSS, so this list is what brings a theme in. */
export function ThemeDecor() {
  return (
    <div className="themeDecor" aria-hidden="true">
      <SpooktoberDecor />
      <AutumnDecor />
      <ChristmasDecor />
      <NewYearsEveDecor />
      <HangoverDecor />
      <WinterDecor />
      <SpringDecor />
      <SyttendeMaiDecor />
      <EarlySummerDecor />
      <SummerDecor />
      <BackToWorkDecor />
    </div>
  )
}
