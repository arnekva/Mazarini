"use client"

import { callApi } from "@/lib/apiClient"
import { proxyImageUrl } from "@/lib/imgProxy"
import { useEffect, useState } from "react"
import styles from "./Modal.module.css"

type GameId = "flag" | "outline" | "capital"

interface Challenge {
  options: string[]
  flagPng?: string
  countryName?: string
  path?: string
  viewBox?: string
}

interface StatusResponse {
  challenge: Challenge
  completed: boolean
  numAttempts: number
  maxAttempts: number
  error?: string
}

interface GuessResponse {
  correct?: boolean
  numAttempts?: number
  attemptsLeft?: number
  revealAnswer?: string
  reward?: number
  chips?: number
  alreadyCompleted?: boolean
  noAttemptsLeft?: boolean
  answer?: string
}

const titles: Record<GameId, string> = {
  flag: "Gjett flagget",
  outline: "Gjett landet fra outline",
  capital: "Si hovedstaden",
}

export function CountryGuessModal({
  game,
  accessToken,
  onClose,
  onSolved,
}: {
  game: GameId
  accessToken: string
  onClose: () => void
  onSolved: (reward: number, chips: number) => void
}) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    callApi<StatusResponse>(`/api/games/${game}`, accessToken).then(setStatus)
  }, [game, accessToken])

  async function guess(option: string) {
    if (busy || done) return
    setBusy(true)
    try {
      const result = await callApi<GuessResponse>(`/api/games/${game}`, accessToken, {
        method: "POST",
        body: JSON.stringify({ guess: option }),
      })

      if (result.alreadyCompleted) {
        setMessage("Du har allerede løst denne i dag.")
        setDone(true)
      } else if (result.noAttemptsLeft) {
        setMessage(`Ingen forsøk igjen. Riktig svar var: ${result.answer}`)
        setDone(true)
      } else if (result.correct) {
        setMessage(`Riktig! ${result.reward ? `Du fikk ${result.reward} chips.` : "Ingen chips denne gangen (maks 3/dag)."}`)
        setDone(true)
        onSolved(result.reward ?? 0, result.chips ?? 0)
      } else {
        const revealed = result.revealAnswer ? ` Riktig svar var: ${result.revealAnswer}` : ""
        setMessage(`Feil!${revealed} ${result.attemptsLeft ?? 0} forsøk igjen.`)
        if (result.revealAnswer) setDone(true)
        setStatus((s) => (s ? { ...s, numAttempts: result.numAttempts ?? s.numAttempts } : s))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{titles[game]}</h2>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {!status && <p className={styles.status}>Laster...</p>}
        {status?.error && <p className={styles.status}>{status.error}</p>}

        {status && !status.error && (
          <>
            <p className={styles.status}>
              Forsøk: {status.numAttempts} / {status.maxAttempts}
            </p>

            <div className={styles.visualBox}>
              {game === "flag" && status.challenge.flagPng && (
                <img className={styles.flagImg} src={proxyImageUrl(status.challenge.flagPng)} alt="Flagg" />
              )}
              {game === "outline" && status.challenge.path && (
                <svg className={styles.outlineSvg} viewBox={status.challenge.viewBox}>
                  <path d={status.challenge.path} />
                </svg>
              )}
              {game === "capital" && <div className={styles.countryName}>{status.challenge.countryName}</div>}
            </div>

            {message && <div className={`${styles.result} ${message.startsWith("Riktig") ? styles.resultCorrect : styles.resultWrong}`}>{message}</div>}

            <div className={styles.optionsGrid}>
              {status.challenge.options.map((option) => (
                <button key={option} className={styles.optionBtn} type="button" disabled={busy || done || status.completed} onClick={() => guess(option)}>
                  {option}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
