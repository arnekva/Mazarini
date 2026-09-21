"use client"

import { callApi } from "@/lib/apiClient"
import { isAdminUser } from "@/lib/admin"
import { useDiscord } from "@/providers/discordProvider"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  const { accessToken, ready, discordUser } = useDiscord()
  const router = useRouter()
  const [status, setStatus] = useState<HubStatus | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const isAdmin = isAdminUser(discordUser?.id)

  useEffect(() => {
    if (!accessToken) return
    callApi<HubStatus>("/api/hub-status", accessToken).then(setStatus)
  }, [accessToken])

  // launchActivity() (used by the /terning pot-win button) always opens this root page - there's no
  // way to deep-link straight into /multiplayer/blackjack through it - so this is the only place
  // that can notice a pending auto-start and send the winner on. Peek-only: doesn't consume the
  // flag, BlackjackGame does that itself once it actually loads and creates the table.
  useEffect(() => {
    if (!accessToken) return
    callApi<{ pending: boolean }>("/api/multiplayer/blackjack/pending-autostart?peek=1", accessToken).then((res) => {
      if (res.pending) {
        setRedirecting(true)
        router.push("/multiplayer/blackjack")
      }
    })
  }, [accessToken, router])

  const loggedIn = ready && !!accessToken

  if (redirecting) {
    return (
      <div className={styles.page}>
        <div className={styles.spinner} aria-label="Åpner Blackjack..." />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>DAILY</h1>
      {/* Always rendered (even before status loads) so its height is reserved from first paint -
          otherwise the cards below jump down once this pops in, right where you're about to click. */}
      <span className={styles.chips}>{status ? `${status.chips} chips` : " "}</span>

      {!ready ? (
        <div className={styles.spinner} aria-label="Laster..." />
      ) : (
        <>
          <div className={styles.section}>
            <div className={styles.row}>
              <HubCard href="/daily-claim" enabled={loggedIn} cardClass="cardGold">
                Daily claim
                <span className={styles.cardSub}>{status?.dailyClaimedToday ? "Hentet i dag" : status ? `Streak: ${status.dailyStreak}` : " "}</span>
              </HubCard>
              <HubCard href="/wheel" enabled={loggedIn} cardClass="cardPurple">
                Lykkehjul
                <span className={styles.cardSub}>{status ? `${status.wheelSpinsLeft} spinn igjen` : " "}</span>
              </HubCard>
            </div>
            <HubCard href="/more-or-less" enabled={loggedIn} cardClass="cardTeal" fullWidth>
              More or Less
              <span className={styles.cardSub}>Ubegrenset antall forsøk</span>
            </HubCard>
            {isAdmin && (
              <HubCard href="/song-rank" enabled cardClass="cardGreen" fullWidth>
                Song Rank
                <span className={styles.cardSub}>Rangér en spilleliste</span>
              </HubCard>
            )}
            <HubCard href="/multiplayer" enabled={loggedIn} cardClass="cardBlue" fullWidth>
              Multiplayer
              <span className={styles.cardSub}>Spill sammen med andre i kanalen</span>
            </HubCard>
          </div>

          <div className={styles.section}>
            <div className={styles.challengeHeader}>
              <strong>Quiz - velg 3 for chips</strong>
              <span className={styles.challengeCount}>
                {status?.challengesCompleted ?? 0} / {status?.maxChallenges ?? 3}
              </span>
            </div>
            <p className={styles.subtitle}>Samme 4 oppgaver for alle i dag - de 3 første riktige gir chips.</p>
            <div className={styles.challengeGrid}>
              {challenges.map((c) => {
                const state = status?.challenges[c.id]
                return (
                  <HubCard key={c.id} href={`/${c.id}`} enabled={loggedIn} cardClass={c.cardClass}>
                    {c.label}
                    <span className={styles.cardSub}>{state?.completed ? "Løst i dag" : state ? `${state.numAttempts} forsøk brukt` : " "}</span>
                  </HubCard>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function HubCard({
  href,
  enabled,
  cardClass,
  fullWidth,
  children,
}: {
  href: string
  enabled: boolean
  cardClass: string
  fullWidth?: boolean
  children: React.ReactNode
}) {
  const className = `${styles.card} ${styles[cardClass]}`
  const style = fullWidth ? { width: "100%" } : undefined

  if (!enabled) {
    return (
      <div className={className} style={{ ...style, opacity: 0.45 }}>
        {children}
      </div>
    )
  }
  return (
    <Link className={className} style={style} href={href}>
      {children}
    </Link>
  )
}
