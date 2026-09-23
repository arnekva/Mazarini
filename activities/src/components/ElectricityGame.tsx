"use client"

import { callApi } from "@/lib/apiClient"
import { proxyImageUrl } from "@/lib/imgProxy"
import { useDiscord } from "@/providers/discordProvider"
import { useEffect, useRef, useState } from "react"
import shared from "./BlackjackGame.module.css"
import styles from "./ElectricityGame.module.css"

interface CardView {
  rank: string
  suit: string
}

interface PlayerView {
  id: string
  username: string
  avatar: string
  card: CardView | null
}

interface SpectatorView {
  id: string
  username: string
  avatar: string
}

interface TableView {
  id: string
  hostId: string
  status: "waiting" | "playing"
  chugOnLoop: boolean
  iAmPlaying: boolean
  iAmSpectating: boolean
  spectators: SpectatorView[]
  players: PlayerView[]
  turnPlayerId: string | null
  lastDrawerId: string | null
  drinkers: string[]
  sips: number | "inf"
  deckCount: number
}

interface LobbySummary {
  id: string
  hostUsername: string
  numPlayers: number
  numSpectators: number
  status: "waiting" | "playing"
}

const LOBBY_POLL_MS = 2000
const TABLE_POLL_MS = 1200

function CardFace({ card }: { card: CardView }) {
  const isRed = card.suit === "♥" || card.suit === "♦"
  return (
    <div className={`${shared.cardFace} ${isRed ? shared.red : shared.black}`}>
      <span className={shared.cornerTop}>
        {card.rank}
        <br />
        {card.suit}
      </span>
      <span className={shared.pip}>{card.suit}</span>
      <span className={shared.cornerBottom}>
        {card.rank}
        <br />
        {card.suit}
      </span>
    </div>
  )
}

function CardBack() {
  return (
    <div className={`${shared.cardFace} ${shared.cardBack}`} style={{ animation: "none" }}>
      <div className={shared.cardBackPattern} />
    </div>
  )
}

/** Seats players evenly around an ellipse, rotated so the viewer always sits at the bottom (like a
 * real table) - with the viewer being a spectator, seat 0 is simply at the bottom instead. */
function seatPosition(index: number, count: number, myIndex: number) {
  const offset = myIndex >= 0 ? myIndex : 0
  const angle = Math.PI / 2 + (2 * Math.PI * (index - offset)) / count
  return { left: `${50 + 40 * Math.cos(angle)}%`, top: `${50 + 38 * Math.sin(angle)}%` }
}

export function ElectricityGame({ accessToken }: { accessToken: string }) {
  const { instanceId, discordUser } = useDiscord()
  const [lobbies, setLobbies] = useState<LobbySummary[] | null>(null)
  const [lobbyId, setLobbyId] = useState<string | null>(null)
  const [table, setTable] = useState<TableView | null>(null)
  const [closedNotice, setClosedNotice] = useState(false)
  const [chugOnLoop, setChugOnLoop] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const initedRef = useRef(false)

  async function refreshLobbies() {
    if (!instanceId) return
    try {
      const res = await callApi<{ lobbies: LobbySummary[]; myLobbyId: string | null }>(
        `/api/multiplayer/electricity/lobbies?instanceId=${encodeURIComponent(instanceId)}`,
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
        `/api/multiplayer/electricity?instanceId=${encodeURIComponent(instanceId)}&lobbyId=${encodeURIComponent(id)}`,
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

  async function action(actionName: "create" | "join" | "spectate" | "leave" | "start" | "draw" | "reshuffle", extra?: Record<string, unknown>) {
    if (!instanceId || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await callApi<TableView>("/api/multiplayer/electricity", accessToken, {
        method: "POST",
        body: JSON.stringify({ instanceId, lobbyId, action: actionName, ...extra }),
      })
      if (actionName === "create" || actionName === "join" || actionName === "spectate") {
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
    const interval = setInterval(
      () => {
        if (lobbyId) refreshTable(lobbyId)
        else refreshLobbies()
      },
      lobbyId ? TABLE_POLL_MS : LOBBY_POLL_MS
    )
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, lobbyId])

  useEffect(() => {
    if (lobbyId) refreshTable(lobbyId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId])

  if (!instanceId) {
    return <p className={shared.info}>Multiplayer krever at appen åpnes som en Discord Activity i en talekanal.</p>
  }

  if (!lobbyId) {
    return (
      <>
        {closedNotice && <p className={shared.info}>Verten forlot bordet - bordet er stengt.</p>}
        <p className={shared.info}>Velg et bord, eller start et nytt.</p>

        {lobbies === null && <p className={shared.info}>Laster bord...</p>}
        {lobbies?.length === 0 && <p className={shared.info}>Ingen åpne bord akkurat nå.</p>}
        {lobbies && lobbies.length > 0 && (
          <div className={shared.lobbyList}>
            {lobbies.map((l) => (
              <div key={l.id} className={shared.lobbyRow}>
                <button
                  className={shared.lobbyRowMain}
                  type="button"
                  disabled={busy || l.status === "playing"}
                  onClick={() => {
                    setClosedNotice(false)
                    action("join", { lobbyId: l.id })
                  }}
                >
                  <span className={shared.lobbyHost}>{l.hostUsername}s bord</span>
                  <span className={shared.lobbyMeta}>
                    {l.numPlayers} spiller{l.numPlayers === 1 ? "" : "e"}
                    {l.numSpectators > 0 ? ` · 👁 ${l.numSpectators}` : ""} · {l.status === "waiting" ? "venter på start" : "pågår"}
                  </span>
                </button>
                <button
                  className={shared.spectateBtn}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setClosedNotice(false)
                    action("spectate", { lobbyId: l.id })
                  }}
                >
                  👁 Se på
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className={shared.error}>{error}</p>}

        <label className={styles.optionRow}>
          <input type="checkbox" checked={chugOnLoop} onChange={(e) => setChugOnLoop(e.target.checked)} />
          Chug hvis det går i sirkel (♾)
        </label>
        <button
          className={shared.dealBtn}
          style={{ width: "100%", marginTop: 10 }}
          type="button"
          disabled={busy}
          onClick={() => {
            setClosedNotice(false)
            action("create", { chugOnLoop })
          }}
        >
          Start nytt bord
        </button>
      </>
    )
  }

  if (!table) return <p className={shared.info}>Kobler til bordet...</p>

  const myId = discordUser?.id
  const myIndex = table.players.findIndex((p) => p.id === myId)
  const myTurn = table.status === "playing" && table.turnPlayerId === myId
  const isHost = myId === table.hostId
  const deckEmpty = table.status === "playing" && table.deckCount === 0
  const drinkerSet = new Set(table.drinkers)
  const turnPlayer = table.players.find((p) => p.id === table.turnPlayerId)
  const lastDrawer = table.players.find((p) => p.id === table.lastDrawerId)
  const sipLabel = table.sips === "inf" ? "♾" : `x${table.sips}`

  return (
    <>
      <div className={shared.topBar}>
        <p className={shared.info}>
          {table.players.length} spiller{table.players.length === 1 ? "" : "e"}
          {table.status === "playing" ? ` · ${table.deckCount} kort igjen` : ""}
        </p>
        <button className={shared.leaveBtn} type="button" disabled={busy} onClick={() => action("leave")}>
          {table.iAmSpectating ? "Slutt å se på" : "Forlat bordet"}
        </button>
      </div>

      <div className={styles.table}>
        <div className={styles.center}>
          <button
            className={`${styles.deck} ${myTurn && !deckEmpty ? styles.deckActive : ""}`}
            type="button"
            disabled={busy || !myTurn || deckEmpty}
            onClick={() => action("draw")}
            aria-label="Trekk kort"
          >
            <CardBack />
            <span className={styles.deckCount}>{table.deckCount}</span>
          </button>
          <div className={styles.centerText}>
            {table.status === "waiting" && "Venter på start"}
            {table.status === "playing" && (myTurn ? "Din tur - trekk!" : `${turnPlayer?.username ?? "?"} sin tur`)}
          </div>
        </div>

        {table.players.map((p, i) => {
          const isTurn = p.id === table.turnPlayerId && table.status === "playing"
          const drinks = drinkerSet.has(p.id)
          return (
            <div
              key={p.id}
              className={`${styles.seat} ${isTurn ? styles.seatTurn : ""} ${drinks ? styles.seatDrinks : ""}`}
              style={seatPosition(i, table.players.length, myIndex)}
            >
              <div className={styles.seatCard}>
                {p.card ? <CardFace key={`${p.card.rank}${p.card.suit}`} card={p.card} /> : <div className={styles.emptyCard} />}
              </div>
              <div className={styles.seatIdentity}>
                <img className={`${styles.avatar} ${p.id === myId ? styles.avatarMe : ""}`} src={proxyImageUrl(p.avatar)} alt="" />
                <span className={styles.seatName}>
                  {p.username}
                  {p.id === table.hostId ? " 👑" : ""}
                </span>
                {drinks && <span className={styles.drinkBadge}>🍷 {sipLabel}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {table.status === "playing" && table.drinkers.length > 0 && (
        <div className={styles.drinkBanner}>
          {table.sips === "inf" ? "♾ Det går i sirkel! Alle chugger!" : `${lastDrawer?.username ?? "?"} trakk - ${table.drinkers.length} må drikke ${table.sips}!`}
        </div>
      )}

      {table.spectators.length > 0 && (
        <div className={shared.spectatorRow}>
          <span className={shared.spectatorLabel}>👁 {table.spectators.length} ser på</span>
          {table.spectators.map((s) => (
            <img key={s.id} className={shared.spectatorAvatar} src={proxyImageUrl(s.avatar)} alt={s.username} title={s.username} />
          ))}
        </div>
      )}

      {error && <p className={shared.error}>{error}</p>}
      {table.iAmSpectating && <p className={shared.info}>Du ser på - ikke med i spillet.</p>}

      {table.status === "waiting" &&
        (isHost ? (
          <button className={shared.dealBtn} style={{ width: "100%" }} type="button" disabled={busy} onClick={() => action("start")}>
            🍷 Start spillet 🍷
          </button>
        ) : (
          <p className={shared.info}>Venter på at verten starter spillet...</p>
        ))}

      {table.status === "playing" && myTurn && !deckEmpty && (
        <button className={shared.dealBtn} style={{ width: "100%" }} type="button" disabled={busy} onClick={() => action("draw")}>
          Trekk kort
        </button>
      )}

      {deckEmpty && table.iAmPlaying && (
        <button className={shared.dealBtn} style={{ width: "100%" }} type="button" disabled={busy} onClick={() => action("reshuffle")}>
          Kortstokken er tom - stokk om
        </button>
      )}

      {table.status === "playing" && isHost && (
        <button className={shared.redealBtn} style={{ marginTop: 10 }} type="button" disabled={busy} onClick={() => action("start")}>
          Start på nytt
        </button>
      )}
    </>
  )
}
