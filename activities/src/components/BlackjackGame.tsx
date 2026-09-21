"use client"

import { callApi } from "@/lib/apiClient"
import { useDiscord } from "@/providers/discordProvider"
import { useEffect, useRef, useState } from "react"
import styles from "./BlackjackGame.module.css"

interface CardView {
  rank: string
  suit: string
}

interface PlayerView {
  id: string
  username: string
  hand: CardView[]
  status: "waiting" | "playing" | "stood" | "bust" | "blackjack"
  value: number
}

interface TableView {
  status: "waiting" | "playing" | "roundOver"
  players: PlayerView[]
  dealer: { hand: CardView[]; value?: number }
  results?: Record<string, "win" | "lose" | "push" | "blackjack">
}

const POLL_MS = 1500

function CardFace({ card }: { card: CardView }) {
  if (card.rank === "?") {
    return (
      <div className={styles.cardFace}>
        <span className={styles.hidden}>🂠</span>
      </div>
    )
  }
  const isRed = card.suit === "♥" || card.suit === "♦"
  return (
    <div className={`${styles.cardFace} ${isRed ? styles.red : ""}`}>
      {card.rank}
      {card.suit}
    </div>
  )
}

const statusLabel: Record<PlayerView["status"], string> = {
  waiting: "Venter på neste runde",
  playing: "Din tur",
  stood: "Sto",
  bust: "Bust",
  blackjack: "Blackjack!",
}

const resultLabel: Record<NonNullable<TableView["results"]>[string], string> = {
  win: "Vant",
  lose: "Tapte",
  push: "Uavgjort",
  blackjack: "Blackjack!",
}

export function BlackjackGame({ accessToken }: { accessToken: string }) {
  const { instanceId, discordUser } = useDiscord()
  const [table, setTable] = useState<TableView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const joinedRef = useRef(false)

  async function refresh() {
    if (!instanceId) return
    try {
      const t = await callApi<TableView>(`/api/multiplayer/blackjack?instanceId=${encodeURIComponent(instanceId)}`, accessToken)
      setTable(t)
    } catch {
      // transient poll failure - next tick retries, no need to surface a flickering error
    }
  }

  async function action(action: "join" | "deal" | "hit" | "stand") {
    if (!instanceId || busy) return
    setBusy(true)
    setError(null)
    try {
      const t = await callApi<TableView & { error?: string }>("/api/multiplayer/blackjack", accessToken, {
        method: "POST",
        body: JSON.stringify({ instanceId, action }),
      })
      if (t.error) setError(t.error)
      else setTable(t)
    } catch {
      setError("Noe gikk galt")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!instanceId) return
    if (!joinedRef.current) {
      joinedRef.current = true
      action("join").then(refresh)
    }
    const interval = setInterval(refresh, POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId])

  if (!instanceId) {
    return <p className={styles.info}>Multiplayer krever at appen åpnes som en Discord Activity i en talekanal.</p>
  }
  if (!table) return <p className={styles.info}>Kobler til bordet...</p>

  const me = table.players.find((p) => p.id === discordUser?.id)
  const canDeal = table.status !== "playing" && table.players.length > 0
  const canAct = table.status === "playing" && me?.status === "playing"

  return (
    <>
      <p className={styles.info}>{table.players.length} spiller{table.players.length === 1 ? "" : "e"} ved bordet.</p>

      <div className={styles.dealerRow}>
        <span className={styles.label}>Dealer {table.dealer.value !== undefined ? `(${table.dealer.value})` : ""}</span>
        <div className={styles.hand}>
          {table.dealer.hand.map((c, i) => (
            <CardFace key={i} card={c} />
          ))}
        </div>
      </div>

      <div className={styles.playersGrid}>
        {table.players.map((p) => (
          <div key={p.id} className={`${styles.playerBlock} ${p.id === discordUser?.id ? styles.playerBlockMe : ""}`}>
            <div className={styles.playerHeader}>
              <span>{p.username}</span>
              <span
                className={`${styles.status} ${p.status === "bust" ? styles.statusBust : ""} ${
                  table.results?.[p.id] === "win" || table.results?.[p.id] === "blackjack" ? styles.statusWin : ""
                }`}
              >
                {table.results?.[p.id] ? resultLabel[table.results[p.id]] : statusLabel[p.status]}
              </span>
            </div>
            <div className={styles.hand}>
              {p.hand.map((c, i) => (
                <CardFace key={i} card={c} />
              ))}
            </div>
            {p.hand.length > 0 && <div className={styles.value}>{p.value}</div>}
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {canAct && (
        <div className={styles.actionRow}>
          <button className={styles.hitBtn} type="button" disabled={busy} onClick={() => action("hit")}>
            Hit
          </button>
          <button className={styles.standBtn} type="button" disabled={busy} onClick={() => action("stand")}>
            Stand
          </button>
        </div>
      )}

      {!canAct && canDeal && (
        <button className={styles.dealBtn} type="button" disabled={busy} onClick={() => action("deal")}>
          {table.status === "roundOver" ? "Nytt parti" : "Del kort"}
        </button>
      )}
    </>
  )
}
