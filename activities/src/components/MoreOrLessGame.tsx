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
  bestAttempt?: number
  numAttempts?: number
  liveReward?: number
}

function formatValue(n: number | undefined, suffix?: string) {
  if (n === undefined) return ""
  return `${n.toLocaleString("no-NO")}${suffix ?? ""}`
}

function relevantValueTitle(verb: string | undefined, valueTitle: string | undefined) {
  if (!valueTitle) return undefined
  if (verb && verb.toLowerCase().includes(valueTitle.toLowerCase())) return undefined
  return valueTitle
}

interface RoundResult {
  correct: boolean
  completed: boolean
  reward: number
  revealLine: string
}

export function MoreOrLessGame({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [liveStats, setLiveStats] = useState({ bestAttempt: 0, numAttempts: 0 })
  const [totalEntries, setTotalEntries] = useState<number | undefined>(undefined)
  const [current, setCurrent] = useState<Item | null>(null)
  const [next, setNext] = useState<Item | null>(null)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [liveReward, setLiveReward] = useState(0)
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [roundOver, setRoundOver] = useState(false)

  async function loadStatus() {
    const s = await callApi<StatusResponse>("/api/games/more-or-less/status", accessToken)
    setStatus(s)
    setLiveStats({ bestAttempt: s.stats.bestAttempt ?? 0, numAttempts: s.stats.numAttempts ?? 0 })
    setTotalEntries(s.category.totalEntries)
    if (s.active) {
      setCurrent(s.active.current)
      setNext(s.active.next)
      setCorrectAnswers(s.active.correctAnswers)
    } else if (!s.unsupported) {
      start()
    }
  }

  useEffect(() => {
    loadStatus()
    function onVisible() {
      if (document.visibilityState === "visible") loadStatus()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  async function start() {
    setBusy(true)
    try {
      const res = await callApi<{ current: Item; next: Item; correctAnswers: number; totalEntries?: number; error?: string }>(
        "/api/games/more-or-less/start",
        accessToken,
        { method: "POST" }
      )
      if (res.error) {
        setStartError(res.error)
        return
      }
      setCurrent(res.current)
      setNext(res.next)
      setCorrectAnswers(0)
      setLiveReward(0)
      setRoundOver(false)
      setStartError(null)
      setResult(null)
      if (res.totalEntries !== undefined) setTotalEntries(res.totalEntries)
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
        setCurrent(null)
        setNext(null)
        setCorrectAnswers(res.correctAnswers ?? correctAnswers)
        setLiveStats((s) => ({ bestAttempt: res.bestAttempt ?? s.bestAttempt, numAttempts: res.numAttempts ?? s.numAttempts }))
        setResult({
          correct: !!res.correct,
          completed: !!res.completedNow,
          reward: res.reward ?? 0,
          revealLine: res.revealedNext
            ? `${res.revealedNext.subject}: ${formatValue(res.revealedNext.answer, status?.category.strings?.valueSuffix)}`
            : "",
        })
      } else {
        setCurrent(res.current ?? null)
        setNext(res.next ?? null)
        setCorrectAnswers(res.correctAnswers ?? correctAnswers)
        setLiveReward(res.liveReward ?? 0)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <p className={contentStyles.status}>Laster...</p>
  if (status.error) return <p className={contentStyles.status}>{status.error}</p>

  const showTotal = liveStats.numAttempts >= 2
  const totalDisplay = showTotal && totalEntries !== undefined ? totalEntries : "?"
  const beatingBest = liveStats.bestAttempt > 0 && correctAnswers > liveStats.bestAttempt

  return (
    <>
      <p className={contentStyles.status}>{status.category.title}</p>
      {status.unsupported && <p className={contentStyles.status}>Denne kategorien støttes ikke i appen ennå - prøv /moreorless i chat.</p>}
      {startError && <p className={contentStyles.status}>{startError}</p>}
      {!status.unsupported && !current && !roundOver && !startError && <p className={contentStyles.status}>Laster spill...</p>}

      {current && next && !roundOver && (
        <>
          <div className={styles.itemBox}>
            {current.image && <img className={styles.itemImg} src={proxyImageUrl(current.image)} alt="" />}
            <div className={styles.itemText}>
              <div className={styles.itemSubject}>{current.subject}</div>
              <div className={styles.itemValue}>
                {status.category.strings?.verb} {formatValue(current.answer, status.category.strings?.valueSuffix)} {relevantValueTitle(status.category.strings?.verb, status.category.strings?.valueTitle)}
              </div>
            </div>
          </div>
          <div className={styles.vs}>VS</div>
          <div className={styles.itemBox}>
            {next.image && <img className={styles.itemImg} src={proxyImageUrl(next.image)} alt="" />}
            <div className={styles.itemText}><div className={styles.itemSubject}>{next.subject}</div></div>
          </div>
          <div className={styles.guessRow}>
            <button className={`${styles.guessBtn} ${styles.lessBtn}`} type="button" disabled={busy} onClick={() => guess(false)}>Mindre</button>
            <button className={`${styles.guessBtn} ${styles.moreBtn}`} type="button" disabled={busy} onClick={() => guess(true)}>Mer</button>
          </div>
          <div className={styles.score}>
            {correctAnswers}/{totalDisplay}
            {liveStats.bestAttempt > 0 && (beatingBest ? <> (+<span className={styles.textGreen}>{liveReward}</span> chips)</> : ` (score: ${liveStats.bestAttempt})`)}
          </div>
        </>
      )}

      {result && (
        <div className={styles.resultBlock}>
          <p className={styles.resultLine}>
            {result.completed ? <>Gratulerer, du har <span className={styles.textGreen}>fullført dagens kategori</span>!</> : result.correct ? <>Du <span className={styles.textGreen}>fullførte</span> hele kategorien!</> : <>Du svarte <span className={styles.textRed}>feil</span></>}
          </p>
          <p className={styles.resultLine}>{result.reward > 0 ? <>Du fikk <span className={styles.textGreen}>+{result.reward}</span> chips</> : "Ingen nye chips - slo ikke din beste"}</p>
          {result.revealLine && <p className={styles.resultLine}>{result.revealLine}</p>}
        </div>
      )}

      {roundOver && <button className={styles.startBtn} type="button" disabled={busy} onClick={start}>Prøv igjen</button>}
    </>
  )
}
