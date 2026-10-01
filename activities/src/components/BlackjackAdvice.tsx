"use client"

import { Move, STRATEGY_SOURCES, StrategyAdvice } from "@/lib/blackjackStrategy"
import { useDiscord } from "@/providers/discordProvider"
import { useState } from "react"
import styles from "./BlackjackAdvice.module.css"

const MOVE_NAMES: Record<Move, string> = { hit: "Trekk (Hit)", stand: "Stå (Stand)", double: "Doble (Double)", split: "Splitt (Split)" }

/** The basic-strategy hint above the action buttons (see lib/blackjackStrategy.ts), with an (i) that opens the reasoning and the sources. */
export function BlackjackAdvice({ advice }: { advice: StrategyAdvice }) {
  const { sdk } = useDiscord()
  const [open, setOpen] = useState(false)

  // Inside Discord a plain link can't leave the Activity - the SDK asks Discord to open it (with its own "leaving Discord" prompt).
  function openSource(url: string) {
    if (sdk) sdk.commands.openExternalLink({ url }).catch(() => {})
    else window.open(url, "_blank", "noopener")
  }

  return (
    <div className={styles.advice}>
      <div className={styles.row}>
        <span className={styles.bulb} aria-hidden="true">
          💡
        </span>
        <div className={styles.text}>
          <span>
            Anbefalt: <strong>{MOVE_NAMES[advice.move]}</strong>
          </span>
          <span className={styles.summary}>{advice.summary}</span>
        </div>
        <button
          type="button"
          className={`${styles.infoBtn} ${open ? styles.infoBtnOpen : ""}`}
          aria-expanded={open}
          aria-label={open ? "Skjul forklaring" : "Vis forklaring"}
          onClick={() => setOpen((o) => !o)}
        >
          i
        </button>
      </div>

      {open && (
        <div className={styles.details}>
          <p className={styles.situation}>{advice.situation}</p>
          {advice.details.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <p className={styles.note}>
            Dette er <em>basic strategy</em>: det trekket som i snitt taper minst over mange runder, regnet ut for alle kombinasjoner av din hånd og
            dealerens kort. Det vinner ikke hver gang - men ingen annen spillestil gjør det bedre i det lange løp (uten å telle kort).
          </p>
          <div className={styles.sources}>
            <span className={styles.sourcesTitle}>Kilder</span>
            {STRATEGY_SOURCES.map((s) => (
              <button key={s.url} type="button" className={styles.source} onClick={() => openSource(s.url)}>
                <span className={styles.sourceLabel}>{s.label} ↗</span>
                <span className={styles.sourceDetail}>{s.detail}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
