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

// Ported from the old canvas-based wheel (RewardWheel.tsx): a quick "wind-up" pull backward before
// the real spin releases forward, both eased rather than linear - makes the wheel feel like it has
// real weight instead of just snapping into a CSS transition.
const PULL_BACK_DEG = 13
const PULL_BACK_MS = 220
const SPIN_MS = 4500
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function WheelGame({ accessToken }: { accessToken: string }) {
  const [sectors, setSectors] = useState<WheelSector[] | null>(null)
  const [spinsLeft, setSpinsLeft] = useState<number | null>(null)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const [popupResult, setPopupResult] = useState<SpinResponse | null>(null)
  const rotationRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    Promise.all([
      callApi<{ rewards: WheelReward[] }>("/api/games/wheel-reward-table", accessToken),
      callApi<{ wheelSpinsLeft: number }>("/api/hub-status", accessToken),
    ]).then(([table, status]) => {
      setSectors(layoutSectors(table.rewards))
      setSpinsLeft(status.wheelSpinsLeft)
    })
  }, [accessToken])

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

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

      const targetIndex = sectors.findIndex((s) => s.name === result.reward)
      const targetSector = targetIndex >= 0 ? sectors[targetIndex] : sectors[0]
      runSpin(targetIndex >= 0 ? targetIndex : 0, targetSector, result)
    } catch {
      setSpinning(false)
      setMessage("Noe gikk galt med lykkehjulet.")
    }
  }

  function runSpin(winnerIndex: number, targetSector: WheelSector, result: SpinResponse) {
    const baseRotation = rotationRef.current
    const finalRotation = rotationForTarget(baseRotation, targetSector.midDeg)
    const spinDistance = finalRotation - baseRotation

    let pullStart: number | null = null
    const animatePullBack = (time: number) => {
      if (pullStart === null) pullStart = time
      const t = Math.min((time - pullStart) / PULL_BACK_MS, 1)
      applyRotation(baseRotation - PULL_BACK_DEG * easeOutQuad(t))

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animatePullBack)
      } else {
        const spinStartRotation = baseRotation - PULL_BACK_DEG
        let spinStart: number | null = null
        const animateSpin = (spinTime: number) => {
          if (spinStart === null) spinStart = spinTime
          const spinT = Math.min((spinTime - spinStart) / SPIN_MS, 1)
          applyRotation(spinStartRotation + (spinDistance + PULL_BACK_DEG) * easeOutCubic(spinT))

          if (spinT < 1) {
            rafRef.current = requestAnimationFrame(animateSpin)
          } else {
            applyRotation(finalRotation)
            onSpinFinished(winnerIndex, result)
          }
        }
        rafRef.current = requestAnimationFrame(animateSpin)
      }
    }
    rafRef.current = requestAnimationFrame(animatePullBack)
  }

  function applyRotation(deg: number) {
    rotationRef.current = deg
    setRotation(deg)
  }

  function onSpinFinished(winnerIndex: number, result: SpinResponse) {
    setSpinning(false)
    setSpinsLeft(result.spinsLeft ?? 0)
    setHighlightIndex(winnerIndex)

    if (result.supported) {
      // Let the winning slice glow for a beat before the popup steals the spotlight.
      setTimeout(() => {
        setPopupResult(result)
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } })
      }, 700)
    } else {
      setMessage(`Du vant: ${result.reward} - denne typen støttes ikke i appen ennå, spør en admin.`)
    }
  }

  function closePopup() {
    setPopupResult(null)
    setHighlightIndex(null)
  }

  if (!sectors || spinsLeft === null) return <p className={contentStyles.status}>Laster...</p>

  return (
    <div>
      <p className={contentStyles.status}>{spinsLeft} spinn igjen i dag</p>
      <SpinWheel sectors={sectors} rotation={rotation} highlightIndex={highlightIndex} />
      <button className={styles.spinBtn} type="button" disabled={spinning || spinsLeft === 0} onClick={spin}>
        {spinsLeft === 0 ? "Ingen spinn igjen" : spinning ? "Spinner..." : "Spin"}
      </button>
      {message && <div className={`${contentStyles.result} ${contentStyles.resultCorrect}`}>{message}</div>}

      {popupResult && (
        <>
          <div className={styles.popupOverlay} onClick={closePopup} />
          <div className={styles.popup}>
            <h2 className={styles.popupTitle}>Gratulerer!</h2>
            <p className={styles.popupBody}>Du vant: {popupResult.reward}!</p>
            <button className={styles.spinBtn} type="button" onClick={closePopup}>
              OK
            </button>
          </div>
        </>
      )}
    </div>
  )
}
