/** A few clouds drifting across a daytime sky (see .themeCloud in light.css), spread out so some are already on screen. */
export function Clouds({ color }: { color?: string }) {
  const clouds = [
    { top: 70, scale: 1, dur: 85, delay: -20 },
    { top: 170, scale: 0.65, dur: 110, delay: -75 },
    { top: 30, scale: 0.8, dur: 95, delay: -50 },
    { top: 240, scale: 0.5, dur: 130, delay: -10 },
  ]
  return (
    <>
      {clouds.map((c, i) => (
        <div
          key={i}
          className="themeCloud"
          style={{ top: c.top, transform: `scale(${c.scale})`, "--dur": `${c.dur}s`, "--delay": `${c.delay}s`, ...(color ? { "--cloud": color } : {}) } as React.CSSProperties}
        />
      ))}
    </>
  )
}
