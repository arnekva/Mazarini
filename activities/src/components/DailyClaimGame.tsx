"use client"

import { callApi } from "@/lib/apiClient"
import { useEffect, useState } from "react"
import contentStyles from "./GameContent.module.css"
import styles from "./MoreOrLessModal.module.css"

interface StatusResponse {
  dailyClaimedToday: boolean
  dailyStreak: number
}

interface ClaimResponse {
  claimed: boolean
  alreadyClaimed?: boolean
  reward?: number
  streak?: number
  chips?: number
  lootAwarded?: boolean
}

export function DailyClaimGame({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    callApi<StatusResponse>("/api/hub-status", accessToken).then(setStatus)
  }, [accessToken])

  async function claim() {
    if (busy || status?.dailyClaimedToday) return
    setBusy(true)
    try {
      const result = await callApi<ClaimResponse>("/api/games/daily-claim", accessToken, { method: "POST" })

      if (result.alreadyClaimed) {
        setMessage("Du har allerede henta daily i dag.")
      } else {
        setMessage(
          `Du fikk ${result.reward} chips! Streak: ${result.streak} dager.${result.lootAwarded ? " Du fikk også en kiste - se meldingen i kanalen!" : ""}`
        )
      }
      setStatus((s) => (s ? { ...s, dailyClaimedToday: true, dailyStreak: result.streak ?? s.dailyStreak } : s))
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <p className={contentStyles.status}>Laster...</p>

  return (
    <>
      <p className={contentStyles.status}>Streak: {status.dailyStreak} dager</p>
      {message && <div className={`${contentStyles.result} ${contentStyles.resultCorrect}`}>{message}</div>}
      <button className={styles.startBtn} type="button" disabled={busy || status.dailyClaimedToday} onClick={claim}>
        {status.dailyClaimedToday ? "Hentet i dag" : "Hent daily"}
      </button>
    </>
  )
}
