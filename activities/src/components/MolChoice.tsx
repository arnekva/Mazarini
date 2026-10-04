"use client"

import { callApi } from "@/lib/apiClient"
import { useEffect, useState } from "react"
import styles from "./MolChoice.module.css"

interface ChoiceStatus {
  tokens: number
  lockedBy: { id: string; name: string } | null
  categories: { slug: string; title: string }[]
}

/** "Velg MOL" (lib/molChoice.ts): spend a token to pick tomorrow's More or Less category. Shown only to someone holding a token, at
 * the bottom of the More or Less page. Once anyone has picked, the day is locked for everyone. */
export function MolChoice({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<ChoiceStatus | null>(null)
  const [slug, setSlug] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chosenTitle, setChosenTitle] = useState<string | null>(null)

  useEffect(() => {
    callApi<ChoiceStatus>("/api/games/more-or-less/choose", accessToken)
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [accessToken])

  async function confirm() {
    if (!slug || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await callApi<{ chosen: { slug: string; title: string }; tokens: number }>("/api/games/more-or-less/choose", accessToken, {
        method: "POST",
        body: JSON.stringify({ slug }),
      })
      setChosenTitle(res.chosen.title)
      setStatus((s) => (s ? { ...s, tokens: res.tokens } : s))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt")
      // Someone else may have taken the day while this page was open - show it as locked.
      callApi<ChoiceStatus>("/api/games/more-or-less/choose", accessToken)
        .then(setStatus)
        .catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  if (chosenTitle) {
    return (
      <div className={styles.box}>
        <p className={styles.title}>Velg MOL</p>
        <p className={styles.text}>Morgendagens kategori er satt til {chosenTitle}.</p>
      </div>
    )
  }
  if (!status || status.tokens <= 0) return null

  return (
    <div className={styles.box}>
      <p className={styles.title}>Velg MOL</p>
      {status.lockedBy ? (
        <p className={styles.text}>Morgendagens kategori har blitt bestemt av {status.lockedBy.name}. Tokenet ditt er ikke brukt.</p>
      ) : (
        <>
          <p className={styles.text}>Velg morgendagens MOL. Du kan velge fritt blant alle, til og med blacklistede kategorier.</p>
          <select className={styles.select} value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy} aria-label="Morgendagens kategori">
            <option value="">Velg kategori...</option>
            {status.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
          <button className={styles.confirmBtn} type="button" disabled={!slug || busy} onClick={confirm}>
            Bekreft
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </>
      )}
    </div>
  )
}
