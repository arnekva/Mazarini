"use client"

import styles from "./page.module.css"

// Static shell for now - completion counts and per-game "already played" state get wired up
// once the daily-puzzle API routes exist (see the daily-hub build plan).
const challenges = [
  { id: "flag", label: "Gjett flagget" },
  { id: "outline", label: "Gjett landet fra outline" },
  { id: "capital", label: "Si hovedstaden" },
  { id: "mastermind", label: "Mastermind" },
] as const

export default function Home() {
  const completed = 0

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>DAILY</h1>

      <div className={styles.section}>
        <div className={styles.row}>
          <button className={styles.card} type="button">
            Daily claim
          </button>
          <button className={styles.card} type="button">
            Lykkehjul
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.challengeHeader}>
          <strong>Daglige utfordringer</strong>
          <span className={styles.challengeCount}>{completed} / 3</span>
        </div>
        <p className={styles.subtitle}>Fullfør opptil 3 for chips i dag - de samme oppgavene gjelder for alle.</p>
        <div className={styles.challengeGrid}>
          {challenges.map((c) => (
            <button key={c.id} className={styles.card} type="button">
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
