"use client"

import { callApi } from "@/lib/apiClient"
import { useEffect, useState } from "react"
import modalStyles from "./Modal.module.css"
import styles from "./MastermindModal.module.css"

interface Guess {
  guess: string[]
  black: number
  white: number
}

interface StatusResponse {
  guesses: Guess[]
  completed: boolean
  numAttempts: number
  maxAttempts: number
  codeLength: number
  colors: string[]
}

interface GuessApiResponse {
  black?: number
  white?: number
  numAttempts?: number
  completed?: boolean
  reward?: number
  chips?: number
  solution?: string[]
  alreadyCompleted?: boolean
  noAttemptsLeft?: boolean
  error?: string
}

const colorHex: Record<string, string> = {
  red: "#ef5b5b",
  blue: "#5865f2",
  yellow: "#f5d442",
  green: "#43b581",
  black: "#111214",
  white: "#f4f4f5",
}

export function MastermindModal({
  accessToken,
  onClose,
  onSolved,
}: {
  accessToken: string
  onClose: () => void
  onSolved: (reward: number, chips: number) => void
}) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [current, setCurrent] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    callApi<StatusResponse>("/api/games/mastermind", accessToken).then((s) => {
      setStatus(s)
      if (s.completed) setDone(true)
    })
  }, [accessToken])

  function addColor(color: string) {
    if (!status || current.length >= status.codeLength) return
    setCurrent((c) => [...c, color])
  }

  function reset() {
    setCurrent([])
  }

  async function submit() {
    if (!status || current.length !== status.codeLength || busy || done) return
    setBusy(true)
    try {
      const result = await callApi<GuessApiResponse>("/api/games/mastermind", accessToken, {
        method: "POST",
        body: JSON.stringify({ guess: current }),
      })

      if (result.alreadyCompleted) {
        setMessage("Du har allerede løst dagens mastermind.")
        setDone(true)
      } else if (result.noAttemptsLeft) {
        setMessage(`Ingen forsøk igjen. Løsningen var: ${result.solution?.join(", ")}`)
        setDone(true)
      } else if (result.completed) {
        setMessage(`Løst! ${result.reward ? `Du fikk ${result.reward} chips.` : "Ingen chips denne gangen (maks 3/dag)."}`)
        setDone(true)
        onSolved(result.reward ?? 0, result.chips ?? 0)
      } else {
        setStatus((s) => (s ? { ...s, guesses: [...s.guesses, { guess: current, black: result.black ?? 0, white: result.white ?? 0 }], numAttempts: result.numAttempts ?? s.numAttempts } : s))
        if (result.solution) {
          setMessage(`Ingen flere forsøk. Løsningen var: ${result.solution.join(", ")}`)
          setDone(true)
        }
      }
      setCurrent([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>Mastermind</h2>
          <button className={modalStyles.closeBtn} onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {!status && <p className={modalStyles.status}>Laster...</p>}

        {status && (
          <>
            <p className={modalStyles.status}>
              Forsøk: {status.numAttempts} / {status.maxAttempts}
            </p>

            {message && (
              <div className={`${modalStyles.result} ${message.startsWith("Løst") ? modalStyles.resultCorrect : modalStyles.resultWrong}`}>{message}</div>
            )}

            {status.guesses.length > 0 && (
              <div className={styles.history}>
                {status.guesses.map((g, i) => (
                  <div key={i} className={styles.historyRow}>
                    {g.guess.map((c, j) => (
                      <span key={j} className={styles.colorSwatch} style={{ background: colorHex[c], width: 16, height: 16, cursor: "default" }} />
                    ))}
                    <div className={styles.historyPegs}>
                      {Array.from({ length: g.black }).map((_, k) => (
                        <span key={`b${k}`} className={`${styles.peg} ${styles.pegBlack}`} />
                      ))}
                      {Array.from({ length: g.white }).map((_, k) => (
                        <span key={`w${k}`} className={`${styles.peg} ${styles.pegWhite}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!done && (
              <>
                <div className={styles.currentGuess}>
                  {Array.from({ length: status.codeLength }).map((_, i) =>
                    current[i] ? (
                      <span key={i} className={styles.colorSwatch} style={{ background: colorHex[current[i]] }} />
                    ) : (
                      <span key={i} className={styles.slot} />
                    )
                  )}
                </div>

                <div className={styles.colorRow}>
                  {status.colors.map((color) => (
                    <button
                      key={color}
                      className={styles.colorSwatch}
                      style={{ background: colorHex[color] }}
                      disabled={busy || current.length >= status.codeLength}
                      onClick={() => addColor(color)}
                      type="button"
                      aria-label={color}
                    />
                  ))}
                </div>

                <div className={styles.actionsRow}>
                  <button className={styles.smallBtn} type="button" disabled={busy || current.length === 0} onClick={reset}>
                    Nullstill
                  </button>
                  <button className={styles.smallBtn} type="button" disabled={busy || current.length !== status.codeLength} onClick={submit}>
                    Gjett
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
