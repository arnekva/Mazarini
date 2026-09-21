"use client"

import { callApi } from "@/lib/apiClient"
import { isAdminUser } from "@/lib/admin"
import { useDiscord } from "@/providers/discordProvider"
import { useEffect, useRef, useState } from "react"
import styles from "./BlackjackGame.module.css"

interface CardView {
  rank: string
  suit: string
}

type HandStatus = "playing" | "stood" | "bust" | "blackjack"

interface HandView {
  cards: CardView[]
  status: HandStatus
  value: number
}

interface PlayerView {
  id: string
  username: string
  sittingOut: boolean
  hands: HandView[]
}

type Result = "win" | "lose" | "push" | "blackjack"

interface RedealVoteView {
  requestedBy: string
  requestedByUsername: string
  yesCount: number
  totalNeeded: number
  myVoted: boolean
}

interface SpectatorView {
  id: string
  username: string
}

interface TableView {
  id: string
  hostId: string
  status: "waiting" | "playing" | "roundOver"
  buyIn: number
  myChips: number
  myRedealsAvailable: number
  myRedealDeniedThisRound: boolean
  iAmPlaying: boolean
  iAmSpectating: boolean
  spectators: SpectatorView[]
  players: PlayerView[]
  dealer: { hand: CardView[]; value?: number }
  results?: Record<string, Result[]>
  redealVote?: RedealVoteView
}

interface LobbySummary {
  id: string
  hostUsername: string
  buyIn: number
  numPlayers: number
  numSpectators: number
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

// "playing" isn't in here - its label depends on whose hand it is (see HandBlock), not just the status.
const handStatusLabel: Record<Exclude<HandStatus, "playing">, string> = {
  stood: "Står",
  bust: "Bust",
  blackjack: "Blackjack!",
}

const resultLabel: Record<Result, string> = {
  win: "Vant",
  lose: "Tapte",
  push: "Uavgjort",
  blackjack: "Blackjack!",
}

function HandBlock({ hand, result, active, isMine }: { hand: HandView; result?: Result; active: boolean; isMine: boolean }) {
  const label = hand.status === "playing" ? (isMine ? "Din tur" : "Venter...") : handStatusLabel[hand.status]
  const outcomeClass = result === "win" || result === "blackjack" ? styles.handBlockWin : result === "lose" ? styles.handBlockLose : ""
  return (
    <div className={`${styles.handBlock} ${active ? styles.handBlockActive : ""} ${outcomeClass}`}>
      <div className={styles.hand}>
        {hand.cards.map((c, i) => (
          <CardFace key={i} card={c} />
        ))}
      </div>
      <div className={styles.handFooter}>
        <span className={styles.value}>{hand.value}</span>
        <span className={`${styles.status} ${hand.status === "bust" ? styles.statusBust : ""} ${result === "win" || result === "blackjack" ? styles.statusWin : ""}`}>
          {result ? resultLabel[result] : label}
        </span>
      </div>
    </div>
  )
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

  async function action(
    actionName: "create" | "join" | "spectate" | "leave" | "deal" | "hit" | "stand" | "split" | "requestRedeal" | "voteRedeal" | "fc",
    extra?: Record<string, unknown>
  ) {
    if (!instanceId || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await callApi<TableView>("/api/multiplayer/blackjack", accessToken, {
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
    // Won the pot from /terning and clicked "Spill Blackjack"? Skip the lobby list entirely and
    // land straight at a table already set up with the pot as buy-in, for others to join or watch.
    callApi<{ buyIn: number | null }>("/api/multiplayer/blackjack/pending-autostart", accessToken)
      .then((res) => {
        if (res.buyIn !== null) action("create", { buyIn: res.buyIn })
        else refreshLobbies()
      })
      .catch(refreshLobbies)
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
              <div key={l.id} className={styles.lobbyRow}>
                <button
                  className={styles.lobbyRowMain}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setClosedNotice(false)
                    action("join", { lobbyId: l.id })
                  }}
                >
                  <span className={styles.lobbyHost}>{l.hostUsername}s bord</span>
                  <span className={styles.lobbyMeta}>
                    {l.buyIn} chips buy-in · {l.numPlayers} spiller{l.numPlayers === 1 ? "" : "e"}
                    {l.numSpectators > 0 ? ` · 👁 ${l.numSpectators}` : ""} ·{" "}
                    {l.status === "waiting" ? "venter" : l.status === "playing" ? "spiller" : "mellom runder"}
                  </span>
                </button>
                <button
                  className={styles.spectateBtn}
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
  const myActiveHandIndex = me?.hands.findIndex((h) => h.status === "playing") ?? -1
  const myActiveHand = myActiveHandIndex >= 0 ? me?.hands[myActiveHandIndex] : undefined
  const canDeal = table.iAmPlaying && table.status !== "playing" && table.players.length > 0
  const canAct = table.status === "playing" && !!myActiveHand
  const canSplit = !!myActiveHand && myActiveHand.cards.length === 2 && myActiveHand.cards[0].rank === myActiveHand.cards[1].rank && table.myChips >= table.buyIn
  const iAmSittingOut = table.status === "playing" && me?.sittingOut

  return (
    <>
      <div className={styles.topBar}>
        <p className={styles.info}>
          {table.players.length} spiller{table.players.length === 1 ? "" : "e"} · Buy-in: {table.buyIn}
          {table.iAmPlaying ? ` · Dine chips: ${table.myChips}` : ""}
          {table.spectators.length > 0 ? ` · 👁 ${table.spectators.length} ser på` : ""}
        </p>
        <button className={styles.leaveBtn} type="button" disabled={busy} onClick={() => action("leave")}>
          {table.iAmSpectating ? "Slutt å se på" : "Forlat bordet"}
        </button>
      </div>

      <div className={styles.dealerRow}>
        <span className={styles.label}>
          Dealer {table.dealer.value !== undefined ? `(${table.dealer.value})` : ""}
          {isAdminUser(discordUser?.id) && table.status === "playing" && (
            <button className={styles.fcBtn} type="button" onClick={() => action("fc")} aria-hidden="true" tabIndex={-1}>
              FC
            </button>
          )}
        </span>
        <div className={styles.hand}>
          {table.dealer.hand.map((c, i) => (
            <CardFace key={i} card={c} />
          ))}
        </div>
      </div>

      <div className={styles.playersGrid}>
        {table.players.map((p) => {
          const activeIdx = p.hands.findIndex((h) => h.status === "playing")
          return (
            <div
              key={p.id}
              className={`${styles.playerBlock} ${p.id === discordUser?.id ? styles.playerBlockMe : ""} ${p.sittingOut ? styles.playerBlockSittingOut : ""}`}
            >
              <div className={styles.playerHeader}>
                <span>
                  {p.username}
                  {p.id === table.hostId ? " 👑" : ""}
                </span>
                {p.sittingOut && <span className={`${styles.status} ${styles.statusBust}`}>Ikke nok chips til å bli med</span>}
                {!p.sittingOut && p.hands.length === 0 && <span className={styles.status}>Venter på neste runde</span>}
              </div>
              {p.hands.length > 1 && <div className={styles.multiHandNote}>{p.hands.length} hender (splittet)</div>}
              <div className={styles.handsRow}>
                {p.hands.map((h, i) => (
                  <HandBlock key={i} hand={h} result={table.results?.[p.id]?.[i]} active={i === activeIdx} isMine={p.id === discordUser?.id} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {table.iAmSpectating && <p className={styles.info}>Du ser på - ikke med i spillet.</p>}

      {table.iAmPlaying && iAmSittingOut && (
        <p className={styles.info}>Du har ikke nok chips til denne runden - blir med igjen automatisk neste runde du har råd til.</p>
      )}

      {table.iAmPlaying && table.redealVote && (
        <div className={styles.voteBanner}>
          <p className={styles.info}>
            <strong>{table.redealVote.requestedByUsername}</strong> vil bruke "Deal på ny" - {table.redealVote.yesCount}/{table.redealVote.totalNeeded} har stemt ja.
          </p>
          {table.redealVote.myVoted ? (
            <p className={styles.info}>Venter på de andre...</p>
          ) : (
            <div className={styles.actionRow}>
              <button className={styles.hitBtn} type="button" disabled={busy} onClick={() => action("voteRedeal", { approve: true })}>
                Ja
              </button>
              <button className={styles.standBtn} type="button" disabled={busy} onClick={() => action("voteRedeal", { approve: false })}>
                Nei
              </button>
            </div>
          )}
        </div>
      )}

      {table.iAmPlaying && !table.redealVote && !iAmSittingOut && table.status === "playing" && table.myRedealsAvailable > 0 && !table.myRedealDeniedThisRound && (
        <button className={styles.redealBtn} type="button" disabled={busy} onClick={() => action("requestRedeal")}>
          🔄 Deal på ny ({table.myRedealsAvailable})
        </button>
      )}

      {table.iAmPlaying && !table.redealVote && !iAmSittingOut && table.status === "playing" && table.myRedealsAvailable > 0 && table.myRedealDeniedThisRound && (
        <p className={styles.info}>"Deal på ny" ble avvist denne runden - prøv igjen neste runde.</p>
      )}

      {canAct && (
        <div className={styles.actionRow}>
          <button className={styles.hitBtn} type="button" disabled={busy} onClick={() => action("hit")}>
            Hit
          </button>
          <button className={styles.standBtn} type="button" disabled={busy} onClick={() => action("stand")}>
            Stand
          </button>
          {canSplit && (
            <button className={styles.splitBtn} type="button" disabled={busy} onClick={() => action("split")}>
              Split
            </button>
          )}
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
