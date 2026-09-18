"use client"

import { callApi } from "@/lib/apiClient"
import { layoutSectors, rotationForTarget, WheelReward, WheelSector } from "@/lib/wheelGeometry"
import confetti from "canvas-confetti"
import { useEffect, useRef, useState } from "react"
import contentStyles from "./GameContent.module.css"
import styles from "./SpinWheel.module.css"
import { SpinWheel } from "./SpinWheel"

interface SpinResponse {
  spun: boolean
  noSpinsLeft?: boolean
  reward?: string
  type?: string
  supported?: boolean
  spinsLeft?: number
  error?: string
}

export function WheelGame({ accessToken }: { accessToken: string }) {
  const [sectors, setSectors] = useState<WheelSector[] | null>(null)
  const [spinsLeft, setSpinsLeft] = useState<number | null>(null)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const pendingResult = useRef<SpinResponse | null>(null)

  useEffect(() => {
    Promise.all([
      callApi<{ rewards: WheelReward[] }>("/api/games/wheel-reward-table", accessToken),
      callApi<{ wheelSpinsLeft: number }>("/api/hub-status", accessToken),
    ]).then(([table, status]) => {
      setSectors(layoutSectors(table.rewards))
      setSpinsLeft(status.wheelSpinsLeft)
    })
  }, [accessToken])

  async function spin() {
    if (spinning || !sectors || spinsLeft === 0) return
    setSpinning(true)
    setMessage(null)
    try {
      const result = await callApi<SpinResponse>("/api/games/wheel-spin", accessToken, { method: "POST" })

      if (result.noSpinsLeft) {
        setSpinning(false)
        setSpinsLeft(0)
        setMessage("Du har ingen spinn igjen i dag.")
        return
      }

      const targetSector = sectors.find((s) => s.name === result.reward) ?? sectors[0]
      pendingResult.current = result
      setRotation((r) => rotationForTarget(r, targetSector.midDeg))
    } catch {
      setSpinning(false)
      setMessage("Noe gikk galt med lykkehjulet.")
    }
  }

  function onSpinFinished() {
    setSpinning(false)
    const result = pendingResult.current
    pendingResult.current = null
    if (!result) return

    setSpinsLeft(result.spinsLeft ?? 0)
    if (result.supported) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } })
      setMessage(`Du vant: ${result.reward}!`)
    } else {
      setMessage(`Du vant: ${result.reward} - denne typen støttes ikke i appen ennå, spør en admin.`)
    }
  }

  if (!sectors || spinsLeft === null) return <p className={contentStyles.status}>Laster...</p>

  return (
    // The transition-end capture must sit above the wheel in the tree (bubbling won't reach a
    // sibling), so it wraps both the wheel and the button rather than sitting beside the wheel.
    <div
      onTransitionEndCapture={(e) => {
        if ((e.target as HTMLElement).classList.contains(styles.wheel)) onSpinFinished()
      }}
    >
      <p className={contentStyles.status}>{spinsLeft} spinn igjen i dag</p>
      <SpinWheel sectors={sectors} rotation={rotation} />
      <button className={styles.spinBtn} type="button" disabled={spinning || spinsLeft === 0} onClick={spin}>
        {spinsLeft === 0 ? "Ingen spinn igjen" : spinning ? "Spinner..." : "Spin"}
      </button>
      {message && <div className={`${contentStyles.result} ${contentStyles.resultCorrect}`}>{message}</div>}
    </div>
  )
}
