"use client"

import { callApi } from "@/lib/apiClient"
import { proxyImageUrl } from "@/lib/imgProxy"
import { useEffect, useState } from "react"
import contentStyles from "./GameContent.module.css"
import styles from "./MoreOrLessModal.module.css"

interface Item {
  subject: string
  answer?: number
  image: string
}

interface StatusResponse {
  category: { title: string; description: string; image: string; strings?: { verb: string; valueTitle: string; valueSuffix?: string }; totalEntries?: number }
  unsupported: boolean
  stats: { bestAttempt?: number; numAttempts?: number; completed?: boolean }
  hasActiveSession: boolean
  active?: { current: Item; next: Item; correctAnswers: number }
  error?: string
}

interface GuessResponse {
  correct?: boolean
  finished?: boolean
  current?: Item
  next?: Item
  correctAnswers?: number
  reward?: number
  chips?: number
  revealedNext?: Item
  completedNow?: boolean
}

function formatValue(n: number | undefined, suffix?: string) {
  if (n === undefined) return ""
  return `${n.toLocaleString("no-NO")}${suffix ?? ""}`
}

// Some categories' `verb` already spells out what valueTitle would repeat (e.g. "has the atomic
// number" + "Atomic number") - skip valueTitle in that case rather than showing it twice.
function relevantValueTitle(verb: string | undefined, valueTitle: string | undefined) {
  if (!valueTitle) return undefined
  if (verb && verb.toLowerCase().includes(valueTitle.toLowerCase())) return undefined
  return valueTitle
}

interface RoundResult {
  correct: boolean
  rewardLine: string
  revealLine: string
}

export function MoreOrLessGame({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [current, setCurrent] = useState<Item | null>(null)
  const [next, setNext] = useState<Item | null>(null)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [roundOver, setRoundOver] = useState(false)

  useEffect(() => {
    callApi<StatusResponse>("/api/games/more-or-less/status", accessToken).then((s) => {
      setStatus(s)
      if (s.active) {
        setCurrent(s.active.current)
        setNext(s.active.next)
        setCorrectAnswers(s.active.correctAnswers)
      }
    })
  }, [accessToken])

  async function start() {
    setBusy(true)
    try {
      const res = await callApi<{ current: Item; next: Item; correctAnswers: number; error?: string }>("/api/games/more-or-less/start", accessToken, {
        method: "POST",
      })
      if (res.error) {
        setStartError(res.error)
        return
      }
      setCurrent(res.current)
      setNext(res.next)
      setCorrectAnswers(0)
      setRoundOver(false)
      setStartError(null)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  async function guess(more: boolean) {
    if (busy) return
    setBusy(true)
    try {
      const res = await callApi<GuessResponse>("/api/games/more-or-less/guess", accessToken, {
        method: "POST",
        body: JSON.stringify({ more }),
      })

      if (res.finished) {
        setRoundOver(true)
        setCorrectAnswers(res.correctAnswers ?? correctAnswers)
        setResult({
          correct: !!res.correct,
          rewardLine: res.reward ? `+${res.reward} chips - ny beste!` : "Ingen nye chips - slo ikke din beste.",
          revealLine: `${res.revealedNext?.subject}: ${formatValue(res.revealedNext?.answer, status?.category.strings?.valueSuffix)}`,
        })
      } else {
        setCurrent(res.current ?? null)
        setNext(res.next ?? null)
        setCorrectAnswers(res.correctAnswers ?? correctAnswers)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <p className={contentStyles.status}>Laster...</p>
  if (status.error) return <p className={contentStyles.status}>{status.error}</p>

  return (
    <>
      <p className={contentStyles.status}>{status.category.title}</p>

      {status.unsupported && <p className={contentStyles.status}>Denne kategorien støttes ikke i appen ennå - prøv /moreorless i chat.</p>}
      {startError && <p className={contentStyles.status}>{startError}</p>}

      {!status.unsupported && !current && (
        <button className={styles.startBtn} type="button" disabled={busy} onClick={start}>
          {status.stats.numAttempts ? "Prøv igjen" : "Start"}
        </button>
      )}

      {current && next && !roundOver && (
        <>
          <div className={styles.itemBox}>
            {current.image && <img className={styles.itemImg} src={proxyImageUrl(current.image)} alt="" />}
            <div className={styles.itemText}>
              <div className={styles.itemSubject}>{current.subject}</div>
              <div className={styles.itemValue}>
                {status.category.strings?.verb} {formatValue(current.answer, status.category.strings?.valueSuffix)}{" "}
                {relevantValueTitle(status.category.strings?.verb, status.category.strings?.valueTitle)}
              </div>
            </div>
          </div>
          <div className={styles.vs}>VS</div>
          <div className={styles.itemBox}>
            {next.image && <img className={styles.itemImg} src={proxyImageUrl(next.image)} alt="" />}
            <div className={styles.itemText}>
              <div className={styles.itemSubject}>{next.subject}</div>
            </div>
          </div>

          <div className={styles.guessRow}>
            <button className={`${styles.guessBtn} ${styles.lessBtn}`} type="button" disabled={busy} onClick={() => guess(false)}>
              Mindre
            </button>
            <button className={`${styles.guessBtn} ${styles.moreBtn}`} type="button" disabled={busy} onClick={() => guess(true)}>
              Mer
            </button>
          </div>
          <div className={styles.score}>{correctAnswers} riktige denne runden</div>
        </>
      )}

      {result && (
        <div className={`${contentStyles.result} ${result.correct ? contentStyles.resultCorrect : contentStyles.resultWrong}`}>
          <div className={styles.resultHeadline}>{result.correct ? "Fullført!" : "Feil svar"}</div>
          <div className={styles.resultLine}>{result.rewardLine}</div>
          <div className={styles.resultLine}>{result.revealLine}</div>
        </div>
      )}

      {roundOver && (
        <button className={styles.startBtn} type="button" disabled={busy} onClick={start}>
          Prøv igjen
        </button>
      )}
    </>
  )
}
