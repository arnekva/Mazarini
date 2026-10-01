"use client"

import { callApi } from "@/lib/apiClient"
import { useEffect, useState } from "react"
import styles from "./AdminPanel.module.css"

interface GiftStatus {
  eligible: boolean
  options?: { id: string; kind: string; label: string; icon: string }[]
  claimedOptionId?: string | null
}

/** The admin-picked gift (see lib/dailyGift.ts), on the Daily claim page: pick one of the options, once per round. Shows nothing at
 * all for anyone the gift isn't for - nor for someone who already picked on an earlier visit: "Du valgte ..." is only shown on the
 * visit the pick was made, and from the next one the page is back to normal. */
export function DailyGiftPicker({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<GiftStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Set once a pick has been made (or found out about) during this visit - the only time what was picked is shown. */
  const [pickedThisVisit, setPickedThisVisit] = useState(false)

  useEffect(() => {
    callApi<GiftStatus>("/api/games/daily-gift", accessToken)
      .then(setStatus)
      .catch(() => setStatus({ eligible: false }))
  }, [accessToken])

  async function pick(optionId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await callApi<{ optionId: string }>("/api/games/daily-gift", accessToken, { method: "POST", body: JSON.stringify({ optionId }) })
      setStatus((s) => (s ? { ...s, claimedOptionId: res.optionId } : s))
      setPickedThisVisit(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt")
      // Already picked elsewhere (another device) while this page was open? Show what it was.
      callApi<GiftStatus>("/api/games/daily-gift", accessToken)
        .then((s) => {
          setStatus(s)
          if (s.claimedOptionId) setPickedThisVisit(true)
        })
        .catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  if (!status?.eligible || !status.options?.length) return null

  const claimed = status.options.find((o) => o.id === status.claimedOptionId)
  if (claimed && !pickedThisVisit) return null
  if (claimed) {
    return (
      <div className={styles.giftBox}>
        <p className={styles.giftTitle}>
          {claimed.icon} Du valgte {claimed.label}
        </p>
        <p className={styles.muted}>
          {claimed.kind === "box" || claimed.kind === "chest" ? "Åpne den med knappen i kanalen." : "Den er lagt til hos deg."} Ny gave kommer en annen dag!
        </p>
      </div>
    )
  }

  return (
    <div className={styles.giftBox}>
      <p className={styles.giftTitle}>🎁 Du har fått en gave! Velg én:</p>
      <div className={styles.giftGrid}>
        {status.options.map((o) => (
          <button key={o.id} type="button" className={styles.giftChoice} disabled={busy} onClick={() => pick(o.id)}>
            <span className={styles.giftIcon}>{o.icon}</span>
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
