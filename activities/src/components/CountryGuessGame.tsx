"use client"

import { callApi } from "@/lib/apiClient"
import { capitalNames, countryNames } from "@/lib/countryLists"
import { findDidYouMean } from "@/lib/fuzzyMatch"
import { proxyImageUrl } from "@/lib/imgProxy"
import { useEffect, useState } from "react"
import styles from "./GameContent.module.css"
import { TypeaheadInput } from "./TypeaheadInput"

export type CountryGameId = "flag" | "outline" | "capital"

interface Challenge {
  flagPng?: string
  countryName?: string
  path?: string
  viewBox?: string
}

// Capital names double as the answer list here, which would make an always-visible suggestion
// dropdown basically a multiple-choice picker - so it gets none, unlike flag/outline's country names
// (which are just a spelling aid, not the thing being guessed).
const suggestionsByGame: Record<CountryGameId, string[]> = {
  flag: countryNames,
  outline: countryNames,
  capital: [],
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
  hint?: { arrow: string; distanceKm: number }
}

export function CountryGuessGame({ game, accessToken }: { game: CountryGameId; accessToken: string }) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [didYouMean, setDidYouMean] = useState<{ original: string; suggestion: string } | null>(null)

  useEffect(() => {
    callApi<StatusResponse>(`/api/games/${game}`, accessToken).then(setStatus)
  }, [game, accessToken])

  function handleSubmit(option: string) {
    if (game === "capital") {
      const suggestion = findDidYouMean(option, capitalNames)
      if (suggestion) {
        setDidYouMean({ original: option, suggestion })
        return
      }
    }
    guess(option)
  }

  async function guess(option: string) {
    if (busy || done) return
    setDidYouMean(null)
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
      } else {
        const revealed = result.revealAnswer ? ` Riktig svar var: ${result.revealAnswer}.` : ""
        const hint = result.hint ? ` ${result.hint.arrow} ~${result.hint.distanceKm.toLocaleString("no-NO")} km unna.` : ""
        setMessage(`Feil!${hint}${revealed} ${result.attemptsLeft ?? 0} forsøk igjen.`)
        if (result.revealAnswer) setDone(true)
        setStatus((s) => (s ? { ...s, numAttempts: result.numAttempts ?? s.numAttempts } : s))
      }
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <p className={styles.status}>Laster...</p>
  if (status.error) return <p className={styles.status}>{status.error}</p>

  return (
    <>
      <p className={styles.status}>
        Forsøk: {status.numAttempts} / {status.maxAttempts}
      </p>

      <div className={styles.visualBox}>
        {game === "flag" && status.challenge.flagPng && <img className={styles.flagImg} src={proxyImageUrl(status.challenge.flagPng)} alt="Flagg" />}
        {game === "outline" && status.challenge.path && (
          <svg className={styles.outlineSvg} viewBox={status.challenge.viewBox}>
            <path d={status.challenge.path} />
          </svg>
        )}
        {game === "capital" && <div className={styles.countryName}>{status.challenge.countryName}</div>}
      </div>

      {message && <div className={`${styles.result} ${message.startsWith("Riktig") ? styles.resultCorrect : styles.resultWrong}`}>{message}</div>}

      {didYouMean && !(busy || done || status.completed) && (
        <div className={styles.status}>
          Mente du <strong>{didYouMean.suggestion}</strong>?{" "}
          <button type="button" onClick={() => guess(didYouMean.suggestion)}>
            Ja
          </button>{" "}
          <button type="button" onClick={() => guess(didYouMean.original)}>
            Nei, send som skrevet
          </button>
        </div>
      )}

      {!didYouMean && !(busy || done || status.completed) && <TypeaheadInput suggestions={suggestionsByGame[game]} onSubmit={handleSubmit} disabled={busy} />}
    </>
  )
}
