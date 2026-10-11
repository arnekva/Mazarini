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

/** Where the game stands - what the server answers with on opening the page and after every guess or skip. */
interface GameView {
  challenge: Challenge
  /** How many of the day's items are settled - the one on screen is number index + 1. */
  index: number
  /** How many items the day has. With 1 the game plays as it always did: attempts counter on top, no skip button. */
  total: number
  correctCount: number
  finished: boolean
  /** Wrong guesses so far on the item on screen. */
  itemAttempts: number
  maxAttempts: number
  /** Chips for one right answer. */
  reward: number
}

interface StatusResponse extends GameView {
  error?: string
}

interface GuessResponse extends Partial<GameView> {
  correct?: boolean
  /** The item is settled (right, out of attempts or skipped) - what's on screen is now the next one, or the end. */
  itemDone?: boolean
  skipped?: boolean
  attemptsLeft?: number
  revealAnswer?: string
  itemReward?: number
  alreadyCompleted?: boolean
  noAttemptsLeft?: boolean
  answer?: string
  hint?: { bearing: number; distanceKm: number }
  error?: string
}

export function CountryGuessGame({ game, accessToken }: { game: CountryGameId; accessToken: string }) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Which way (degrees clockwise from north) the answer lies from the last wrong guess - drawn as an arrow rotated by exactly that.
  const [hint, setHint] = useState<{ bearing: number; distanceKm: number } | null>(null)
  const [didYouMean, setDidYouMean] = useState<{ original: string; suggestion: string } | null>(null)
  // The outline shown full-screen - it's kept small on the page so the answer field fits below it.
  const [zoomed, setZoomed] = useState(false)

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

  /** Takes in what the server says after a guess or a skip: where the game stands now (and so which item is on screen). */
  function applyView(result: GuessResponse) {
    if (result.challenge === undefined || result.index === undefined || result.total === undefined) return
    const next: GameView = {
      challenge: result.challenge,
      index: result.index,
      total: result.total,
      correctCount: result.correctCount ?? 0,
      finished: !!result.finished,
      itemAttempts: result.itemAttempts ?? 0,
      maxAttempts: result.maxAttempts ?? 3,
      reward: result.reward ?? 0,
    }
    setStatus(next)
    if (next.finished) setDone(true)
  }

  function endText(result: GuessResponse) {
    const total = result.total ?? 1
    return total > 1 && result.finished ? ` Ferdig! Du fikk ${result.correctCount ?? 0} av ${total} riktige.` : ""
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
      const several = (result.total ?? status?.total ?? 1) > 1

      if (result.alreadyCompleted) {
        setMessage("Du har allerede løst denne i dag.")
        setDone(true)
      } else if (result.noAttemptsLeft) {
        setMessage(`Ingen forsøk igjen. Riktig svar var: ${result.answer}`)
        setDone(true)
      } else if (result.correct) {
        setHint(null)
        setMessage(
          `Riktig! ${
            result.itemReward ? `Du fikk ${result.itemReward} chips.` : several ? "" : "Ingen chips denne gangen (maks 3/dag)."
          }${endText(result)}`.trim()
        )
        applyView(result)
        setDone(!!result.finished || !several)
      } else if (result.itemDone) {
        // Out of attempts on this one: the answer, then the next item (or the end).
        setHint(null)
        setMessage(`Feil! Riktig svar var: ${result.revealAnswer}.${endText(result)}`)
        applyView(result)
        setDone(!!result.finished || !several)
      } else {
        const distance = result.hint ? ` ~${result.hint.distanceKm.toLocaleString("no-NO")} km unna.` : ""
        setHint(result.hint ?? null)
        setMessage(`Feil!${distance} ${result.attemptsLeft ?? 0} forsøk igjen.`)
        applyView(result)
      }
    } finally {
      setBusy(false)
    }
  }

  async function skip() {
    if (busy || done) return
    setDidYouMean(null)
    setBusy(true)
    try {
      const result = await callApi<GuessResponse>(`/api/games/${game}`, accessToken, {
        method: "POST",
        body: JSON.stringify({ skip: true }),
      })
      if (result.alreadyCompleted) {
        setMessage("Du har allerede løst denne i dag.")
        setDone(true)
      } else {
        setHint(null)
        setMessage(`Hoppet over. Riktig svar var: ${result.revealAnswer}.${endText(result)}`)
        applyView(result)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <p className={styles.status}>Laster...</p>
  if (status.error) return <p className={styles.status}>{status.error}</p>

  const several = status.total > 1
  const over = done || status.finished

  return (
    <>
      <p className={styles.status}>
        {several ? `${Math.min(status.index + 1, status.total)} / ${status.total}` : `Forsøk: ${status.itemAttempts} / ${status.maxAttempts}`}
      </p>

      <div className={styles.visualBox}>
        {game === "flag" && status.challenge.flagPng && <img className={styles.flagImg} src={proxyImageUrl(status.challenge.flagPng)} alt="Flagg" />}
        {game === "outline" && status.challenge.path && (
          <button type="button" className={styles.outlineButton} onClick={() => setZoomed(true)} aria-label="Forstørr omrisset">
            <svg className={styles.outlineSvg} viewBox={status.challenge.viewBox}>
              <path d={status.challenge.path} />
            </svg>
          </button>
        )}
        {game === "capital" && <div className={styles.countryName}>{status.challenge.countryName}</div>}
      </div>
      {game === "outline" && status.challenge.path && <div className={styles.zoomHint}>Trykk på omrisset for å se detaljene</div>}
      {zoomed && status.challenge.path && (
        <div className={styles.zoomOverlay} onClick={() => setZoomed(false)} role="button" aria-label="Lukk">
          <svg className={styles.outlineZoomed} viewBox={status.challenge.viewBox}>
            <path d={status.challenge.path} />
          </svg>
        </div>
      )}

      {message && <div className={`${styles.result} ${message.startsWith("Riktig") || message.startsWith("Hoppet") ? styles.resultCorrect : styles.resultWrong}`}>{message}</div>}

      {hint && !over && (
        <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }} role="img" aria-label={`Riktig svar ligger ${hint.bearing} grader fra nord`}>
          <svg width="44" height="44" viewBox="-22 -22 44 44" style={{ transform: `rotate(${hint.bearing}deg)` }}>
            <path d="M0 -18 L11 2 L3 -1 L3 18 L-3 18 L-3 -1 L-11 2 Z" fill="currentColor" />
          </svg>
        </div>
      )}

      {didYouMean && !(busy || over) && (
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

      {/* One item a day: no skip, as it always was. Several: skipping is there next to the guess button. */}
      {!didYouMean && !(busy || over) && (
        <TypeaheadInput suggestions={suggestionsByGame[game]} onSubmit={handleSubmit} disabled={busy} onSkip={several ? skip : undefined} />
      )}
    </>
  )
}
