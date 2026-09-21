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
  status: "waiting" | "playing" | "stood" | "bust" | "blackjack" | "sittingOut"
  value: number
}

interface TableView {
  id: string
  hostId: string
  status: "waiting" | "playing" | "roundOver"
  buyIn: number
  myChips: number
  players: PlayerView[]
  dealer: { hand: CardView[]; value?: number }
  results?: Record<string, "win" | "lose" | "push" | "blackjack">
}

interface LobbySummary {
  id: string
  hostUsername: string
  buyIn: number
  numPlayers: number
  status: "waiting" | "playing" | "roundOver"
}

const LOBBY_POLL_MS = 2000
const TABLE_POLL_MS = 1500

function CardFace({ card }: { card: CardView }) {
  if (card.rank === "?") {
    return (
      <div className={`${styles.cardFace} ${styles.cardBack}`}>
        <div className={styles.cardBackPattern} />
      </div>
    )
  }
  const isRed = card.suit === "♥" || card.suit === "♦"
  return (
    <div className={`${styles.cardFace} ${isRed ? styles.red : styles.black}`}>
      <span className={styles.cornerTop}>
        {card.rank}
        <br />
        {card.suit}
      </span>
      <span className={styles.pip}>{card.suit}</span>
      <span className={styles.cornerBottom}>
        {card.rank}
        <br />
        {card.suit}
      </span>
    </div>
  )
}

const statusLabel: Record<PlayerView["status"], string> = {
  waiting: "Venter på neste runde",
  playing: "Din tur",
  stood: "Sto",
  bust: "Bust",
  blackjack: "Blackjack!",
  sittingOut: "Ikke nok chips til å bli med",
}

const resultLabel: Record<NonNullable<TableView["results"]>[string], string> = {
  win: "Vant",
  lose: "Tapte",
  push: "Uavgjort",
  blackjack: "Blackjack!",
}

export function BlackjackGame({ accessToken }: { accessToken: string }) {
  const { instanceId, discordUser } = useDiscord()
  const [lobbies, setLobbies] = useState<LobbySummary[] | null>(null)
  const [lobbyId, setLobbyId] = useState<string | null>(null)
  const [table, setTable] = useState<TableView | null>(null)
  const [closedNotice, setClosedNotice] = useState(false)
  const [createBuyIn, setCreateBuyIn] = useState("0")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const initedRef = useRef(false)

  async function refreshLobbies() {
    if (!instanceId) return
    try {
      const res = await callApi<{ lobbies: LobbySummary[]; myLobbyId: string | null }>(
        `/api/multiplayer/blackjack/lobbies?instanceId=${encodeURIComponent(instanceId)}`,
        accessToken
      )
      setLobbies(res.lobbies)
      if (res.myLobbyId && !lobbyId) setLobbyId(res.myLobbyId)
    } catch {
      // transient poll failure - next tick retries
    }
  }

  async function refreshTable(id: string) {
    if (!instanceId) return
    try {
      const res = await callApi<TableView & { closed?: boolean }>(
        `/api/multiplayer/blackjack?instanceId=${encodeURIComponent(instanceId)}&lobbyId=${encodeURIComponent(id)}`,
        accessToken
      )
      if (res.closed) {
        setClosedNotice(true)
        setTable(null)
        setLobbyId(null)
      } else {
        setTable(res)
      }
    } catch {
      // transient poll failure - next tick retries
    }
  }

  async function action(actionName: "create" | "join" | "leave" | "deal" | "hit" | "stand", extra?: Record<string, unknown>) {
    if (!instanceId || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await callApi<TableView>("/api/multiplayer/blackjack", accessToken, {
        method: "POST",
        body: JSON.stringify({ instanceId, lobbyId, action: actionName, ...extra }),
      })
      if (actionName === "create" || actionName === "join") {
        setLobbyId(res.id)
        setTable(res)
      } else if (actionName === "leave") {
        setLobbyId(null)
        setTable(null)
        refreshLobbies()
      } else {
        setTable(res)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!instanceId || initedRef.current) return
    initedRef.current = true
    refreshLobbies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId])

  useEffect(() => {
    if (!instanceId) return
    const interval = setInterval(() => {
      if (lobbyId) refreshTable(lobbyId)
      else refreshLobbies()
    }, lobbyId ? TABLE_POLL_MS : LOBBY_POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, lobbyId])

  useEffect(() => {
    if (lobbyId) refreshTable(lobbyId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId])

  if (!instanceId) {
    return <p className={styles.info}>Multiplayer krever at appen åpnes som en Discord Activity i en talekanal.</p>
  }

  if (!lobbyId) {
    return (
      <>
        {closedNotice && <p className={styles.info}>Verten forlot bordet - bordet er stengt.</p>}
        <p className={styles.info}>Velg et bord, eller start et nytt.</p>

        {lobbies === null && <p className={styles.info}>Laster bord...</p>}
        {lobbies?.length === 0 && <p className={styles.info}>Ingen åpne bord akkurat nå.</p>}
        {lobbies && lobbies.length > 0 && (
          <div className={styles.lobbyList}>
            {lobbies.map((l) => (
              <button
                key={l.id}
                className={styles.lobbyRow}
                type="button"
                disabled={busy}
                onClick={() => {
                  setClosedNotice(false)
                  action("join", { lobbyId: l.id })
                }}
              >
                <span className={styles.lobbyHost}>{l.hostUsername}s bord</span>
                <span className={styles.lobbyMeta}>
                  {l.buyIn} chips buy-in · {l.numPlayers} spiller{l.numPlayers === 1 ? "" : "e"} · {l.status === "waiting" ? "venter" : l.status === "playing" ? "spiller" : "mellom runder"}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.startRow}>
          <input
            className={styles.buyInInput}
            type="number"
            min={0}
            step={1}
            value={createBuyIn}
            onChange={(e) => setCreateBuyIn(e.target.value)}
            aria-label="Buy-in i chips"
          />
          <button
            className={styles.dealBtn}
            type="button"
            disabled={busy}
            onClick={() => {
              setClosedNotice(false)
              action("create", { buyIn: Number(createBuyIn) || 0 })
            }}
          >
            Start nytt bord
          </button>
        </div>
      </>
    )
  }

  if (!table) return <p className={styles.info}>Kobler til bordet...</p>

  const me = table.players.find((p) => p.id === discordUser?.id)
  const canDeal = table.status !== "playing" && table.players.length > 0
  const canAct = table.status === "playing" && me?.status === "playing"
  const iAmSittingOut = table.status === "playing" && me?.status === "sittingOut"

  return (
    <>
      <div className={styles.topBar}>
        <p className={styles.info}>
          {table.players.length} spiller{table.players.length === 1 ? "" : "e"} · Buy-in: {table.buyIn} · Dine chips: {table.myChips}
        </p>
        <button className={styles.leaveBtn} type="button" disabled={busy} onClick={() => action("leave")}>
          Forlat bordet
        </button>
      </div>

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
          <div
            key={p.id}
            className={`${styles.playerBlock} ${p.id === discordUser?.id ? styles.playerBlockMe : ""} ${
              p.status === "sittingOut" ? styles.playerBlockSittingOut : ""
            }`}
          >
            <div className={styles.playerHeader}>
              <span>
                {p.username}
                {p.id === table.hostId ? " 👑" : ""}
              </span>
              <span
                className={`${styles.status} ${p.status === "bust" || p.status === "sittingOut" ? styles.statusBust : ""} ${
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

      {iAmSittingOut && <p className={styles.info}>Du har ikke nok chips til denne runden - blir med igjen automatisk neste runde du har råd til.</p>}

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
          Nytt parti
        </button>
      )}
    </>
  )
}
