"use client"

import { callApi } from "@/lib/apiClient"
import { CountryGuessModal } from "@/components/CountryGuessModal"
import { MastermindModal } from "@/components/MastermindModal"
import { MoreOrLessModal } from "@/components/MoreOrLessModal"
import { useDiscord } from "@/providers/discordProvider"
import { useEffect, useState } from "react"
import styles from "./page.module.css"

type ChallengeId = "flag" | "outline" | "capital" | "mastermind"

const challenges: { id: ChallengeId; label: string; cardClass: string }[] = [
  { id: "flag", label: "Gjett flagget", cardClass: "cardBlue" },
  { id: "outline", label: "Gjett landet fra outline", cardClass: "cardGreen" },
  { id: "capital", label: "Si hovedstaden", cardClass: "cardRed" },
  { id: "mastermind", label: "Mastermind", cardClass: "cardPurple" },
]

interface HubStatus {
  chips: number
  dailyClaimedToday: boolean
  dailyStreak: number
  wheelSpinsLeft: number
  challengesCompleted: number
  maxChallenges: number
  challenges: Record<ChallengeId, { completed: boolean; numAttempts: number }>
}

export default function Home() {
  const { accessToken, ready } = useDiscord()
  const [status, setStatus] = useState<HubStatus | null>(null)
  const [busy, setBusy] = useState<"daily" | "wheel" | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [openChallenge, setOpenChallenge] = useState<ChallengeId | null>(null)
  const [moreOrLessOpen, setMoreOrLessOpen] = useState(false)

  function refreshStatus() {
    if (!accessToken) return
    callApi<HubStatus>("/api/hub-status", accessToken).then(setStatus).catch(() => setToast("Klarte ikke å hente status."))
  }

  useEffect(refreshStatus, [accessToken])

  async function claimDaily() {
    if (!accessToken || busy) return
    setBusy("daily")
    try {
      const result = await callApi<{
        claimed: boolean
        alreadyClaimed?: boolean
        reward?: number
        streak?: number
        chips?: number
        lootAwarded?: boolean
      }>("/api/games/daily-claim", accessToken, { method: "POST" })

      if (result.alreadyClaimed) {
        setToast("Du har allerede henta daily i dag.")
      } else {
        setToast(
          `Du fikk ${result.reward} chips! Streak: ${result.streak} dager.${result.lootAwarded ? " Du fikk også en kiste - se meldingen i kanalen!" : ""}`
        )
        setStatus((s) => (s ? { ...s, chips: result.chips ?? s.chips, dailyClaimedToday: true, dailyStreak: result.streak ?? s.dailyStreak } : s))
      }
    } catch {
      setToast("Noe gikk galt med daily claim.")
    } finally {
      setBusy(null)
    }
  }

  async function spinWheel() {
    if (!accessToken || busy) return
    setBusy("wheel")
    try {
      const result = await callApi<{ spun: boolean; noSpinsLeft?: boolean; reward?: string; supported?: boolean; spinsLeft?: number }>(
        "/api/games/wheel-spin",
        accessToken,
        { method: "POST" }
      )

      if (result.noSpinsLeft) {
        setToast("Du har ingen spinn igjen i dag.")
      } else if (!result.supported) {
        setToast("Du vant noe hjulet ikke støtter ennå - spør en admin.")
        setStatus((s) => (s ? { ...s, wheelSpinsLeft: result.spinsLeft ?? s.wheelSpinsLeft } : s))
      } else {
        setToast(`Hjulet ga deg: ${result.reward}!`)
        setStatus((s) => (s ? { ...s, wheelSpinsLeft: result.spinsLeft ?? s.wheelSpinsLeft } : s))
      }
    } catch {
      setToast("Noe gikk galt med lykkehjulet.")
    } finally {
      setBusy(null)
    }
  }

  function onChallengeSolved(reward: number, chips: number) {
    setStatus((s) => (s ? { ...s, chips, challengesCompleted: Math.min(s.maxChallenges, s.challengesCompleted + (reward > 0 ? 1 : 0)) } : s))
    refreshStatus()
  }

  const loggedIn = ready && !!accessToken

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>DAILY</h1>
      {status && <span className={styles.chips}>{status.chips} chips</span>}

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.section}>
        <div className={styles.row}>
          <button
            className={`${styles.card} ${styles.cardGold}`}
            type="button"
            disabled={!loggedIn || busy !== null || status?.dailyClaimedToday}
            onClick={claimDaily}
          >
            Daily claim
            <span className={styles.cardSub}>{status?.dailyClaimedToday ? "Hentet i dag" : status ? `Streak: ${status.dailyStreak}` : " "}</span>
          </button>
          <button
            className={`${styles.card} ${styles.cardPurple}`}
            type="button"
            disabled={!loggedIn || busy !== null || status?.wheelSpinsLeft === 0}
            onClick={spinWheel}
          >
            Lykkehjul
            <span className={styles.cardSub}>{status ? `${status.wheelSpinsLeft} spinn igjen` : " "}</span>
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.challengeHeader}>
          <strong>Daglige utfordringer</strong>
          <span className={styles.challengeCount}>
            {status?.challengesCompleted ?? 0} / {status?.maxChallenges ?? 3}
          </span>
        </div>
        <p className={styles.subtitle}>Fullfør opptil 3 for chips i dag - de samme oppgavene gjelder for alle.</p>
        <div className={styles.challengeGrid}>
          {challenges.map((c) => {
            const state = status?.challenges[c.id]
            return (
              <button
                key={c.id}
                className={`${styles.card} ${styles[c.cardClass]}`}
                type="button"
                disabled={!loggedIn}
                onClick={() => setOpenChallenge(c.id)}
              >
                {c.label}
                <span className={styles.cardSub}>{state?.completed ? "Løst i dag" : state ? `${state.numAttempts} forsøk brukt` : " "}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.section}>
        <button className={`${styles.card} ${styles.cardGreen}`} type="button" disabled={!loggedIn} onClick={() => setMoreOrLessOpen(true)} style={{ width: "100%" }}>
          More or Less
          <span className={styles.cardSub}>Ubegrenset antall forsøk</span>
        </button>
      </div>

      {openChallenge && openChallenge !== "mastermind" && accessToken && (
        <CountryGuessModal game={openChallenge} accessToken={accessToken} onClose={() => setOpenChallenge(null)} onSolved={onChallengeSolved} />
      )}
      {openChallenge === "mastermind" && accessToken && (
        <MastermindModal accessToken={accessToken} onClose={() => setOpenChallenge(null)} onSolved={onChallengeSolved} />
      )}
      {moreOrLessOpen && accessToken && (
        <MoreOrLessModal accessToken={accessToken} onClose={() => setMoreOrLessOpen(false)} onReward={(_, chips) => setStatus((s) => (s ? { ...s, chips } : s))} />
      )}
    </div>
  )
}
