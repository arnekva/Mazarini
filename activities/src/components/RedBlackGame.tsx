"use client"

import { callApi } from "@/lib/apiClient"
import { proxyImageUrl } from "@/lib/imgProxy"
import { useDiscord } from "@/providers/discordProvider"
import { useEffect, useRef, useState } from "react"
import shared from "./BlackjackGame.module.css"
import el from "./ElectricityGame.module.css"
import styles from "./RedBlackGame.module.css"

interface CardView {
  rank: string
  suit: string
}

interface PlayerView {
  id: string
  username: string
  avatar: string
  cardCount: number
  cards: CardView[]
}

type RbRound = "RB" | "UD" | "IO" | "SUIT" | "DONE"
type Phase = "waiting" | "rb" | "gt" | "bus" | "finished"

interface GtCardView {
  card: CardView
  lane: 0 | 1 | 2 | 3
  row: number
  revealed: boolean
}

interface TableView {
  id: string
  hostId: string
  phase: Phase
  rbRound: RbRound
  rbSips: number
  iAmPlaying: boolean
  iAmSpectating: boolean
  spectators: { id: string; username: string; avatar: string }[]
  players: PlayerView[]
  turnPlayerId: string | null
  last?: { playerId: string; username: string; round: Exclude<RbRound, "DONE">; guess: string; card: CardView; correct: boolean; sips: number }
  gt?: {
    cards: GtCardView[]
    nextIndex: number
    placements: { playerId: string; username: string; card: CardView }[]
    sipsPerRow: number
    flipRemainingMs: number
  }
  bus?: {
    stage: "pickLoser" | "riding" | "done"
    candidates: { id: string; username: string }[]
    loserId: string | null
    cards: { card: CardView; revealed: boolean }[]
    nextIndex: number
    totalSips: number
    awaitingRetry: boolean
    last?: { guess: string; correct: boolean; sips: number }
  }
  serverNow: number
}

interface LobbySummary {
  id: string
  hostUsername: string
  numPlayers: number
  numSpectators: number
  phase: Phase
}

type ActionName =
  | "create"
  | "join"
  | "spectate"
  | "leave"
  | "start"
  | "guess"
  | "nextPhase"
  | "gtFlip"
  | "gtPlace"
  | "revealLoser"
  | "pickLoser"
  | "busGuess"
  | "busRetry"

const LOBBY_POLL_MS = 2000
const TABLE_POLL_MS = 1200

const ROUND_TITLE: Record<Exclude<RbRound, "DONE">, string> = {
  RB: "Rød eller svart",
  UD: "Opp eller ned",
  IO: "Innenfor eller utenfor",
  SUIT: "Har du suiten?",
}

const ROUND_BUTTONS: Record<Exclude<RbRound, "DONE">, { guess: string; label: string }[]> = {
  RB: [
    { guess: "red", label: "🟥 Rød" },
    { guess: "black", label: "⬛ Svart" },
  ],
  UD: [
    { guess: "up", label: "⬆ Opp" },
    { guess: "same", label: "＝ Likt" },
    { guess: "down", label: "⬇ Ned" },
  ],
  IO: [
    { guess: "in", label: "Innenfor" },
    { guess: "same", label: "＝ Likt" },
    { guess: "out", label: "Utenfor" },
  ],
  SUIT: [
    { guess: "yes", label: "Ja, har den" },
    { guess: "no", label: "Nei" },
  ],
}

const GUESS_LABEL: Record<string, string> = {
  red: "rød",
  black: "svart",
  up: "opp",
  down: "ned",
  same: "likt",
  in: "innenfor",
  out: "utenfor",
  yes: "ja",
  no: "nei",
}

const sipWord = (n: number) => `${n} slurk${n === 1 ? "" : "er"}`

function CardFace({ card }: { card: CardView }) {
  if (card.rank === "?") {
    return (
      <div className={`${shared.cardFace} ${shared.cardBack}`} style={{ animation: "none" }}>
        <div className={shared.cardBackPattern} />
      </div>
    )
  }
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

/** Compact card for a hand - up to 4-5 of these have to fit next to a seat. */
function MiniCard({ card }: { card: CardView }) {
  if (card.rank === "?") return <span className={`${styles.mini} ${styles.miniBack}`} />
  const red = card.suit === "♥" || card.suit === "♦"
  return (
    <span className={`${styles.mini} ${red ? styles.miniRed : ""}`}>
      {card.rank}
      {card.suit}
    </span>
  )
}

function seatPosition(index: number, count: number, myIndex: number) {
  const offset = myIndex >= 0 ? myIndex : 0
  const angle = Math.PI / 2 + (2 * Math.PI * (index - offset)) / count
  return { left: `${50 + 40 * Math.cos(angle)}%`, top: `${50 + 38 * Math.sin(angle)}%` }
}

function gtLabel(c: GtCardView, sipsPerRow: number) {
  const n = c.row * sipsPerRow
  if (c.lane === 3) return "CHUG!"
  if (c.lane === 0) return `Gi ${n}`
  if (c.lane === 1) return `Ta ${n}`
  return `Gi og ta ${n}`
}

export function RedBlackGame({ accessToken }: { accessToken: string }) {
  const { instanceId, discordUser } = useDiscord()
  const [lobbies, setLobbies] = useState<LobbySummary[] | null>(null)
  const [lobbyId, setLobbyId] = useState<string | null>(null)
  const [table, setTable] = useState<TableView | null>(null)
  const [closedNotice, setClosedNotice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [flipDeadline, setFlipDeadline] = useState(0)
  const initedRef = useRef(false)

  function acceptTable(res: TableView) {
    setFlipDeadline(Date.now() + (res.gt?.flipRemainingMs ?? 0))
    setTable(res)
  }

  async function refreshLobbies() {
    if (!instanceId) return
    try {
      const res = await callApi<{ lobbies: LobbySummary[]; myLobbyId: string | null }>(
        `/api/multiplayer/redblack/lobbies?instanceId=${encodeURIComponent(instanceId)}`,
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
        `/api/multiplayer/redblack?instanceId=${encodeURIComponent(instanceId)}&lobbyId=${encodeURIComponent(id)}`,
        accessToken
      )
      if (res.closed) {
        setClosedNotice(true)
        setTable(null)
        setLobbyId(null)
      } else {
        acceptTable(res)
      }
    } catch {
      // transient poll failure - next tick retries
    }
  }

  async function action(actionName: ActionName, extra?: Record<string, unknown>) {
    if (!instanceId || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await callApi<TableView>("/api/multiplayer/redblack", accessToken, {
        method: "POST",
        body: JSON.stringify({ instanceId, lobbyId, action: actionName, ...extra }),
      })
      if (actionName === "create" || actionName === "join" || actionName === "spectate") {
        setLobbyId(res.id)
        acceptTable(res)
      } else if (actionName === "leave") {
        setLobbyId(null)
        setTable(null)
        refreshLobbies()
      } else {
        acceptTable(res)
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

  // Ticks the clock during the Give/Take phase so the flip cooldown counts down visibly.
  const inGt = table?.phase === "gt"
  useEffect(() => {
    if (!inGt) return
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [inGt])

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
            {lobbies.map((l) => {
              const joinable = l.phase === "waiting" || l.phase === "finished"
              return (
                <div key={l.id} className={shared.lobbyRow}>
                  <button
                    className={shared.lobbyRowMain}
                    type="button"
                    disabled={busy || !joinable}
                    onClick={() => {
                      setClosedNotice(false)
                      action("join", { lobbyId: l.id })
                    }}
                  >
                    <span className={shared.lobbyHost}>{l.hostUsername}s bord</span>
                    <span className={shared.lobbyMeta}>
                      {l.numPlayers} spiller{l.numPlayers === 1 ? "" : "e"}
                      {l.numSpectators > 0 ? ` · 👁 ${l.numSpectators}` : ""} · {joinable ? "venter på start" : "pågår"}
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
              )
            })}
          </div>
        )}

        {error && <p className={shared.error}>{error}</p>}

        <button
          className={shared.dealBtn}
          style={{ width: "100%" }}
          type="button"
          disabled={busy}
          onClick={() => {
            setClosedNotice(false)
            action("create")
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
  const me = table.players[myIndex]
  const isHost = myId === table.hostId
  const myTurn = table.turnPlayerId === myId
  const turnPlayer = table.players.find((p) => p.id === table.turnPlayerId)
  const activeRound = table.rbRound !== "DONE" ? table.rbRound : null

  const gt = table.gt
  const gtCurrent = gt && gt.nextIndex > 0 ? gt.cards[gt.nextIndex - 1] : undefined
  const flipRemainingMs = gt ? Math.max(0, flipDeadline - now) : 0
  const gtAllFlipped = !!gt && gt.nextIndex >= gt.cards.length
  const canPlace = !!gtCurrent && !!me?.cards.some((c) => c.rank === gtCurrent.card.rank)

  const bus = table.bus
  const busLoser = table.players.find((p) => p.id === bus?.loserId)
  const iAmLoser = !!bus && bus.loserId === myId

  return (
    <>
      <div className={shared.topBar}>
        <p className={shared.info}>
          {table.players.length} spiller{table.players.length === 1 ? "" : "e"}
          {table.phase === "rb" && activeRound ? ` · Fase 1: ${ROUND_TITLE[activeRound]}` : ""}
          {table.phase === "rb" && !activeRound ? " · Fase 1 ferdig" : ""}
          {table.phase === "gt" ? " · Fase 2: Gi / Ta" : ""}
          {table.phase === "bus" ? " · Fase 3: Bussen" : ""}
        </p>
        <button className={shared.leaveBtn} type="button" disabled={busy} onClick={() => action("leave")}>
          {table.iAmSpectating ? "Slutt å se på" : "Forlat bordet"}
        </button>
      </div>

      {/* ---------- Circle table: lobby + phase 1 ---------- */}
      {(table.phase === "waiting" || table.phase === "rb") && (
        <div className={el.table}>
          <div className={el.center}>
            <div className={`${shared.cardFace} ${shared.cardBack}`} style={{ animation: "none" }}>
              <div className={shared.cardBackPattern} />
            </div>
            <div className={el.centerText}>
              {table.phase === "waiting" && "Venter på start"}
              {table.phase === "rb" && activeRound && (myTurn ? "Din tur!" : `${turnPlayer?.username ?? "?"} sin tur`)}
              {table.phase === "rb" && !activeRound && "Alle er ferdige"}
            </div>
          </div>

          {table.players.map((p, i) => (
            <div
              key={p.id}
              className={`${el.seat} ${p.id === table.turnPlayerId && table.phase === "rb" ? el.seatTurn : ""}`}
              style={seatPosition(i, table.players.length, myIndex)}
            >
              <div className={styles.hand}>
                {p.cards.map((c, ci) => (
                  <MiniCard key={ci} card={c} />
                ))}
              </div>
              <div className={el.seatIdentity}>
                <img className={`${el.avatar} ${p.id === myId ? el.avatarMe : ""}`} src={proxyImageUrl(p.avatar)} alt="" />
                <span className={el.seatName}>
                  {p.username}
                  {p.id === table.hostId ? " 👑" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {table.phase === "rb" && activeRound && (
        <div className={styles.roundBanner}>
          <strong>{ROUND_TITLE[activeRound]}</strong> · rett gjetning gir bort {sipWord(table.rbSips)}, feil drikker {table.rbSips}
        </div>
      )}

      {table.phase === "rb" && table.last && (
        <div className={`${styles.resultBanner} ${table.last.correct ? styles.resultOk : styles.resultBad}`}>
          <CardFace card={table.last.card} />
          <span>
            <strong>{table.last.username}</strong> gjettet {GUESS_LABEL[table.last.guess]} ({ROUND_TITLE[table.last.round].toLowerCase()}) —{" "}
            {table.last.correct ? `riktig! 🍷 Gi bort ${sipWord(table.last.sips)}` : `feil! 🍷 Drikk ${sipWord(table.last.sips)}`}
          </span>
        </div>
      )}

      {table.phase === "rb" && activeRound && myTurn && (
        <div className={shared.actionRow}>
          {ROUND_BUTTONS[activeRound].map((b) => (
            <button key={b.guess} className={shared.hitBtn} type="button" disabled={busy} onClick={() => action("guess", { guess: b.guess })}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {table.phase === "rb" && !activeRound && (
        <button className={shared.dealBtn} style={{ width: "100%", marginTop: 10 }} type="button" disabled={busy || !table.iAmPlaying} onClick={() => action("nextPhase")}>
          Neste fase: Gi / Ta →
        </button>
      )}

      {/* ---------- Phase 2: Give / Take pyramid ---------- */}
      {table.phase === "gt" && gt && (
        <>
          <div className={styles.gtGrid}>
            {[...gt.cards.filter((c) => c.lane === 3), ...[4, 3, 2, 1].flatMap((row) => gt.cards.filter((c) => c.row === row))].map((c) => {
              const index = gt.cards.indexOf(c)
              const isCurrent = index === gt.nextIndex - 1
              return (
                <div key={index} className={`${styles.gtCell} ${c.lane === 3 ? styles.gtChug : ""} ${isCurrent ? styles.gtCurrent : ""}`}>
                  <CardFace card={c.card} />
                  <span className={`${styles.gtLabel} ${c.lane === 1 ? styles.gtTake : c.lane === 2 ? styles.gtBoth : c.lane === 3 ? styles.gtTake : ""}`}>
                    {gtLabel(c, gt.sipsPerRow)}
                  </span>
                </div>
              )
            })}
          </div>

          {gtCurrent && (
            <div className={styles.roundBanner}>
              <strong>{gtLabel(gtCurrent, gt.sipsPerRow)}</strong> — de som legger ned et {gtCurrent.card.rank}-kort {gtCurrent.lane === 3 ? "må chugge" : "utfører det"}
              {gt.placements.length > 0 && (
                <ul className={styles.placementList}>
                  {gt.placements.map((pl, i) => (
                    <li key={i}>
                      {pl.username} la ned {pl.card.rank}
                      {pl.card.suit}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className={styles.myHandBox}>
            <span className={shared.label}>Dine kort ({me?.cardCount ?? 0})</span>
            <div className={styles.hand}>
              {me?.cards.length ? me.cards.map((c, i) => <MiniCard key={i} card={c} />) : <span className={shared.info}>Ingen kort igjen</span>}
            </div>
          </div>

          <div className={styles.playerStrip}>
            {table.players.map((p) => (
              <span key={p.id} className={styles.stripPlayer}>
                <img className={el.avatar} src={proxyImageUrl(p.avatar)} alt="" />
                {p.username}: {p.cardCount}
              </span>
            ))}
          </div>

          {error && <p className={shared.error}>{error}</p>}

          {table.iAmPlaying && (
            <div className={shared.actionRow}>
              {canPlace && (
                <button className={shared.splitBtn} type="button" disabled={busy} onClick={() => action("gtPlace")}>
                  Legg ned {gtCurrent?.card.rank}
                </button>
              )}
              {!gtAllFlipped && (
                <button className={shared.dealBtn} type="button" disabled={busy || flipRemainingMs > 0} onClick={() => action("gtFlip")}>
                  {flipRemainingMs > 0 ? `Snu neste (${Math.ceil(flipRemainingMs / 1000)}s)` : gt.nextIndex === 0 ? "Snu første kort" : "Snu neste kort"}
                </button>
              )}
              {gtAllFlipped && (
                <button className={shared.standBtn} type="button" disabled={busy || flipRemainingMs > 0} onClick={() => action("revealLoser")}>
                  {flipRemainingMs > 0 ? `Finn taperen (${Math.ceil(flipRemainingMs / 1000)}s)` : "Finn taperen 🚌"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ---------- Phase 3: the bus ---------- */}
      {table.phase === "bus" && bus && (
        <>
          <div className={styles.playerStrip}>
            {table.players.map((p) => (
              <span key={p.id} className={`${styles.stripPlayer} ${p.id === bus.loserId ? styles.stripLoser : ""}`}>
                <img className={el.avatar} src={proxyImageUrl(p.avatar)} alt="" />
                {p.username}: {p.cards.map((c) => `${c.rank}${c.suit}`).join(" ") || "–"}
              </span>
            ))}
          </div>

          {bus.stage === "pickLoser" && (
            <div className={styles.roundBanner}>
              <strong>Uavgjort!</strong> Flere har like mange kort og samme sum. Første som trykker velger hvem som tar bussturen:
              <div className={shared.actionRow}>
                {bus.candidates.map((c) => (
                  <button key={c.id} className={shared.standBtn} type="button" disabled={busy} onClick={() => action("pickLoser", { loserId: c.id })}>
                    {c.username}
                  </button>
                ))}
              </div>
            </div>
          )}

          {bus.stage === "riding" && (
            <>
              <div className={styles.roundBanner}>
                🚌 <strong>{busLoser?.username ?? "?"}</strong> tar bussturen! Gjett om neste kort er høyere, lavere eller likt. Feil på kort N = drikk N og start på nytt.
                <br />
                Totalt drukket så langt: <strong>{bus.totalSips}</strong>
              </div>
              <div className={styles.busRow}>
                {bus.cards.map((c, i) => (
                  <div key={i} className={`${styles.busCell} ${i === bus.nextIndex ? styles.gtCurrent : ""}`}>
                    <CardFace card={c.card} />
                  </div>
                ))}
              </div>
              {bus.last && !bus.last.correct && (
                <div className={`${styles.resultBanner} ${styles.resultBad}`}>Feil! 🍷 Drikk {sipWord(bus.last.sips)} og prøv igjen.</div>
              )}
              {error && <p className={shared.error}>{error}</p>}
              {iAmLoser && !bus.awaitingRetry && (
                <div className={shared.actionRow}>
                  <button className={shared.hitBtn} type="button" disabled={busy} onClick={() => action("busGuess", { guess: "up" })}>
                    ⬆ Opp
                  </button>
                  <button className={shared.hitBtn} type="button" disabled={busy} onClick={() => action("busGuess", { guess: "same" })}>
                    ＝ Likt
                  </button>
                  <button className={shared.hitBtn} type="button" disabled={busy} onClick={() => action("busGuess", { guess: "down" })}>
                    ⬇ Ned
                  </button>
                </div>
              )}
              {iAmLoser && bus.awaitingRetry && (
                <button className={shared.dealBtn} style={{ width: "100%" }} type="button" disabled={busy} onClick={() => action("busRetry")}>
                  Prøv igjen
                </button>
              )}
              {!iAmLoser && <p className={shared.info}>Venter på at {busLoser?.username ?? "bussjåføren"} gjetter...</p>}
            </>
          )}
        </>
      )}

      {/* ---------- Finished ---------- */}
      {table.phase === "finished" && (
        <>
          {bus && busLoser ? (
            <>
              <div className={styles.busRow}>
                {bus.cards.map((c, i) => (
                  <div key={i} className={styles.busCell}>
                    <CardFace card={c.card} />
                  </div>
                ))}
              </div>
              <div className={`${styles.resultBanner} ${styles.resultOk}`}>
                🚌 {busLoser.username} kom helt frem og drakk til sammen {sipWord(bus.totalSips)}. Gz!
              </div>
            </>
          ) : (
            <p className={shared.info}>Spillet er over.</p>
          )}
          {isHost ? (
            <button className={shared.dealBtn} style={{ width: "100%" }} type="button" disabled={busy} onClick={() => action("start")}>
              Nytt spill
            </button>
          ) : (
            <p className={shared.info}>Venter på at verten starter et nytt spill...</p>
          )}
        </>
      )}

      {table.spectators.length > 0 && (
        <div className={shared.spectatorRow}>
          <span className={shared.spectatorLabel}>👁 {table.spectators.length} ser på</span>
          {table.spectators.map((s) => (
            <img key={s.id} className={shared.spectatorAvatar} src={proxyImageUrl(s.avatar)} alt={s.username} title={s.username} />
          ))}
        </div>
      )}

      {table.phase !== "gt" && table.phase !== "bus" && error && <p className={shared.error}>{error}</p>}
      {table.iAmSpectating && <p className={shared.info}>Du ser på - ikke med i spillet.</p>}

      {table.phase === "waiting" &&
        (isHost ? (
          <button className={shared.dealBtn} style={{ width: "100%" }} type="button" disabled={busy} onClick={() => action("start")}>
            🍷 Start spillet 🍷
          </button>
        ) : (
          <p className={shared.info}>Venter på at verten starter spillet...</p>
        ))}

      {isHost && (table.phase === "rb" || table.phase === "gt" || table.phase === "bus") && (
        <button className={shared.redealBtn} style={{ marginTop: 10 }} type="button" disabled={busy} onClick={() => action("start")}>
          Start på nytt
        </button>
      )}
    </>
  )
}
