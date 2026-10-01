"use client"

import { callApi } from "@/lib/apiClient"
import { recommendMove } from "@/lib/blackjackStrategy"
import { BlackjackAdvice } from "./BlackjackAdvice"
import adviceStyles from "./BlackjackAdvice.module.css"
import { isAdminUser } from "@/lib/admin"
import { proxyImageUrl } from "@/lib/imgProxy"
import { useLivePolling } from "@/lib/liveSignal"
import { useDiscord } from "@/providers/discordProvider"
import { useEffect, useRef, useState } from "react"
import styles from "./BlackjackGame.module.css"
import { ChatMessage, GameChat, postChatTo } from "./GameChat"
import { SpectatorBar } from "./SpectatorBar"

interface CardView {
  rank: string
  suit: string
}

type HandStatus = "playing" | "stood" | "bust" | "blackjack"

interface HandView {
  cards: CardView[]
  status: HandStatus
  value: number
  /** Doubled down - twice the buy-in riding on it. */
  doubled?: boolean
}

interface PlayerView {
  id: string
  username: string
  avatar: string
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

interface BetVoteView {
  proposedBuyIn: number
  requestedBy: string
  requestedByUsername: string
  yesCount: number
  totalNeeded: number
  myVoted: boolean
}

interface SpectatorView {
  id: string
  username: string
  avatar: string
}

interface TableView {
  id: string
  /** Changes with every change to the table - compared with the database's to know whether this view is behind. */
  version?: number
  hostId: string
  status: "waiting" | "playing" | "roundOver"
  buyIn: number
  myChips: number
  myRedealsAvailable: number
  /** Only on a seat funded by a deathroll pot win: what's left of that pot money - the most this seat can bet. */
  myPotBankroll?: number
  myRedealDeniedThisRound: boolean
  iAmPlaying: boolean
  iAmSpectating: boolean
  spectators: SpectatorView[]
  players: PlayerView[]
  dealer: { hand: CardView[]; value?: number }
  results?: Record<string, Result[]>
  /** "Tilbakelegg" - chips refunded to the deathroll pot this round, keyed by whose loss triggered it. */
  potRefunds?: Record<string, number>
  redealVote?: RedealVoteView
  betVote?: BetVoteView
  roundOverAt?: number
  roundStartCooldownMs?: number
  frameSeq?: number
  chat?: ChatMessage[]
  /** Earned a "Deal på ny" from the round that just ended (a deathroll-pot stake that won). */
  myGotRedealBonus?: boolean
  /** Only for spectators: what happened since their last poll, oldest first. */
  frames?: { seq: number; view: TableView }[]
}

interface LobbySummary {
  id: string
  hostId: string
  hostUsername: string
  buyIn: number
  numPlayers: number
  numSpectators: number
  status: "waiting" | "playing" | "roundOver"
}

const LOBBY_POLL_MS = 2000
// Someone waiting for a table to appear, and spectators of a running one, want it as live as it gets.
const WATCH_POLL_MS = 700
const TABLE_POLL_MS = 1000

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
        <span className={styles.value}>
          {hand.value}
          {hand.doubled && <span className={styles.doubledBadge}>×2</span>}
        </span>
        <span className={`${styles.status} ${hand.status === "bust" ? styles.statusBust : ""} ${result === "win" || result === "blackjack" ? styles.statusWin : ""}`}>
          {result ? resultLabel[result] : label}
        </span>
      </div>
    </div>
  )
}

export function BlackjackGame({ accessToken, watchHostId }: { accessToken: string; watchHostId?: string }) {
  const { instanceId, discordUser } = useDiscord()
  const [lobbies, setLobbies] = useState<LobbySummary[] | null>(null)
  const [lobbyId, setLobbyId] = useState<string | null>(null)
  // The table we're at right now, known the moment it changes (the state above only catches up on the next render): an answer
  // about a table we've since left must not be acted on - it would report our own leaving as the table closing.
  const lobbyIdRef = useRef<string | null>(null)
  const enterLobby = (id: string | null) => {
    lobbyIdRef.current = id
    setLobbyId(id)
  }
  const [table, setTable] = useState<TableView | null>(null)
  const [closedNotice, setClosedNotice] = useState(false)
  const [removedNotice, setRemovedNotice] = useState(false)
  const [createBuyIn, setCreateBuyIn] = useState("0")
  const [betInput, setBetInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // Set while waiting for this person's table to show up in the list (a pot winner's table that isn't started yet) - it's joined as a spectator the moment it does.
  const [waitingForHost, setWaitingForHost] = useState<string | null>(watchHostId ?? null)
  const initedRef = useRef(false)
  const waitingForHostRef = useRef(waitingForHost)
  // The polling loops below live in an effect that only restarts when the lobby changes - they reach the current action() through this.
  const actionRef = useRef<typeof action>(null as unknown as typeof action)
  // No poll whose answer is older than an action the player has taken since it was sent - it would put a stale table back on screen.
  // Bumped when an action starts and again when it finishes, so it's odd exactly while one is in flight.
  const actSeqRef = useRef(0)
  // What the newest answer from the server had in it - what live updates are compared against (see useLivePolling).
  const shownRef = useRef<{ version?: number; chatAt?: number; chips?: number }>({})
  const noteShown = (res: TableView) => {
    shownRef.current = { version: res.version, chatAt: res.chat?.at(-1)?.at, chips: res.myChips }
  }
  const spectatingRef = useRef(false)
  // Spectating: the newest frame already shown, the ones still waiting to be shown, and whether the queue is being played (see playFrames).
  const lastFrameRef = useRef<number | null>(null)
  const frameQueueRef = useRef<{ seq: number; view: TableView }[]>([])
  const playingRef = useRef(false)

  /** Replays what a spectator missed between two polls, one frame at a time, so a round that started and ended within a second still shows up. */
  function playFrames() {
    if (playingRef.current) return
    const step = () => {
      const frame = frameQueueRef.current.shift()
      if (!frame) {
        playingRef.current = false
        return
      }
      playingRef.current = true
      // A frame is the shared table only - what's about the viewer (chips, seat) stays as it was.
      setTable((prev) =>
        prev
          ? {
              ...frame.view,
              myChips: prev.myChips,
              myRedealsAvailable: prev.myRedealsAvailable,
              myRedealDeniedThisRound: prev.myRedealDeniedThisRound,
              myGotRedealBonus: false,
              chat: prev.chat,
              iAmPlaying: prev.iAmPlaying,
              iAmSpectating: prev.iAmSpectating,
            }
          : prev
      )
      setTimeout(step, frameQueueRef.current.length > 4 ? 350 : 800)
    }
    step()
  }

  async function refreshLobbies() {
    if (!instanceId) return
    try {
      const res = await callApi<{ lobbies: LobbySummary[]; myLobbyId: string | null }>(
        `/api/multiplayer/blackjack/lobbies?instanceId=${encodeURIComponent(instanceId)}`,
        accessToken
      )
      setLobbies(res.lobbies)
      if (res.myLobbyId && !lobbyId) {
        setWaitingForHost(null)
        enterLobby(res.myLobbyId)
        return
      }
      const target = waitingForHostRef.current ? res.lobbies.find((l) => l.hostId === waitingForHostRef.current) : undefined
      if (target && !lobbyId) {
        setWaitingForHost(null)
        setClosedNotice(false)
        actionRef.current("spectate", { lobbyId: target.id })
      }
    } catch {
      // transient poll failure - next tick retries
    }
  }

  async function refreshTable(id: string) {
    if (!instanceId || lobbyIdRef.current !== id) return
    const actSeq = actSeqRef.current
    try {
      const since = spectatingRef.current && lastFrameRef.current !== null ? `&since=${lastFrameRef.current}` : ""
      const res = await callApi<TableView & { closed?: boolean }>(
        `/api/multiplayer/blackjack?instanceId=${encodeURIComponent(instanceId)}&lobbyId=${encodeURIComponent(id)}${since}`,
        accessToken
      )
      if (actSeqRef.current !== actSeq || lobbyIdRef.current !== id) return
      if (res.closed) {
        setClosedNotice(true)
        setTable(null)
        enterLobby(null)
      } else if (!res.iAmPlaying && !res.iAmSpectating) {
        // Our own connection went quiet for long enough that the table dropped us (see the presence notes in blackjackHandler.ts).
        setRemovedNotice(true)
        setTable(null)
        enterLobby(null)
      } else {
        noteShown(res)
        spectatingRef.current = res.iAmSpectating
        if (res.iAmSpectating) {
          const fresh = (res.frames ?? []).filter((f) => f.seq > (lastFrameRef.current ?? -1))
          if (fresh.length > 0) {
            frameQueueRef.current.push(...fresh)
            playFrames()
          }
          lastFrameRef.current = Math.max(lastFrameRef.current ?? 0, res.frameSeq ?? 0)
          // While frames are being replayed the live view would jump ahead of them - the next poll after they've played catches up.
          if (!playingRef.current && fresh.length === 0) setTable(res)
        } else {
          setTable(res)
        }
      }
    } catch {
      // transient poll failure - next tick retries
    }
  }

  async function action(
    actionName:
      | "create"
      | "join"
      | "spectate"
      | "leave"
      | "deal"
      | "hit"
      | "stand"
      | "split"
      | "double"
      | "requestRedeal"
      | "voteRedeal"
      | "setBet"
      | "voteBet"
      | "ownChips"
      | "fc",
    extra?: Record<string, unknown>
  ) {
    if (!instanceId || busy) return
    setBusy(true)
    actSeqRef.current++
    setError(null)
    try {
      const res = await callApi<TableView>("/api/multiplayer/blackjack", accessToken, {
        method: "POST",
        body: JSON.stringify({ instanceId, lobbyId, action: actionName, ...extra }),
      })
      if (actionName !== "leave") noteShown(res)
      if (actionName === "create" || actionName === "join" || actionName === "spectate") {
        setRemovedNotice(false)
        // Starting over at a new table: whatever a previous one had queued to replay is of no interest.
        frameQueueRef.current = []
        lastFrameRef.current = actionName === "spectate" ? res.frameSeq ?? 0 : null
        spectatingRef.current = actionName === "spectate"
        enterLobby(res.id)
        setTable(res)
      } else if (actionName === "leave") {
        frameQueueRef.current = []
        lastFrameRef.current = null
        spectatingRef.current = false
        enterLobby(null)
        setTable(null)
        refreshLobbies()
      } else {
        setTable(res)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt")
    } finally {
      setBusy(false)
      actSeqRef.current++
      // Anything that happened at the table while the action was in flight is picked up now.
      sync()
    }
  }
  useEffect(() => {
    waitingForHostRef.current = waitingForHost
    actionRef.current = action
  })

  useEffect(() => {
    if (!instanceId || initedRef.current) return
    initedRef.current = true
    if (watchHostId) {
      // Sent here to watch someone's table: it may not exist yet, in which case refreshLobbies waits for it.
      refreshLobbies()
      return
    }
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

  // In a lobby: the table, starting right away. Otherwise: the list of tables. Either way the database says when there's something new.
  const sync = useLivePolling({
    key: instanceId ? `${instanceId}/${lobbyId ?? ""}` : null,
    accessToken,
    paths: lobbyId
      ? [
          { path: `other/multiplayerBlackjack/${instanceId}/${lobbyId}/updatedAt`, shown: () => shownRef.current.version },
          { tail: `other/multiplayerBlackjackChat/${instanceId}/${lobbyId}`, shownAt: () => shownRef.current.chatAt },
          { path: `users/${discordUser?.id}/chips`, shown: () => shownRef.current.chips, empty: 0 },
        ]
      : [`other/multiplayerBlackjack/${instanceId}`],
    poll: () => (lobbyId ? refreshTable(lobbyId) : refreshLobbies()),
    delayMs: () => (lobbyId ? (spectatingRef.current ? WATCH_POLL_MS : TABLE_POLL_MS) : waitingForHostRef.current ? WATCH_POLL_MS : LOBBY_POLL_MS),
    // Straight away only when we've landed at a table without having its view yet (found ourselves in the list) - creating or joining one already answered with it.
    immediate: !!lobbyId && !table,
    paused: () => actSeqRef.current % 2 === 1,
  })

  // Ticks `now` while a post-round cooldown is active, so the "Nytt parti" button's countdown
  // actually counts down instead of just sitting disabled with no feedback - see dealCooldownMs below.
  useEffect(() => {
    if (!table?.roundOverAt) return
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [table?.roundOverAt])

  if (!instanceId) {
    return <p className={styles.info}>Multiplayer krever at appen åpnes som en Discord Activity i en talekanal.</p>
  }

  if (!lobbyId) {
    if (waitingForHost) {
      return (
        <>
          <p className={styles.info}>Venter på at bordet blir startet - du blir med som tilskuer så fort det er oppe.</p>
          <button className={styles.leaveBtn} type="button" onClick={() => setWaitingForHost(null)}>
            Se alle bord i stedet
          </button>
        </>
      )
    }
    return (
      <>
        {closedNotice && <p className={styles.info}>Verten forlot bordet - bordet er stengt.</p>}
        {removedNotice && <p className={styles.info}>Du mistet tilkoblingen en stund og ble tatt av bordet.</p>}
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
  const dealCooldownMs = table.roundOverAt ? Math.max(0, (table.roundStartCooldownMs ?? 3000) - (now - table.roundOverAt)) : 0
  const canDeal = table.iAmPlaying && table.status !== "playing" && table.players.length > 0 && dealCooldownMs === 0
  const canAct = table.status === "playing" && !!myActiveHand
  const playingPotMoney = table.myPotBankroll !== undefined
  // A pot-funded seat only ever bets the pot money, never the chips the player had before.
  const mySpendable = playingPotMoney ? Math.min(table.myChips, table.myPotBankroll!) : table.myChips
  // Double down: any hand still on its first two cards, split hands included, with a buy-in to spare.
  const canDouble = !!myActiveHand && myActiveHand.cards.length === 2 && mySpendable >= table.buyIn
  const canSplit = !!myActiveHand && myActiveHand.cards.length === 2 && myActiveHand.cards[0].rank === myActiveHand.cards[1].rank && mySpendable >= table.buyIn
  // Basic strategy for the hand that's up, against the dealer's face-up card (the other one is hidden while the round is on).
  const dealerUp = table.dealer.hand[0]
  const advice =
    canAct && myActiveHand && dealerUp && dealerUp.rank !== "?"
      ? recommendMove({ cards: myActiveHand.cards, dealerUp, canDouble, canSplit })
      : null
  const iAmSittingOut = table.status === "playing" && me?.sittingOut
  const canAdjustBet = table.iAmPlaying && table.status !== "playing" && !table.betVote
  // "Deal på ny" only exists before the first card is drawn (or a split made) - after that the hand has been played. Natural blackjack still counts.
  const canRedeal = !!me && me.hands.length === 1 && me.hands[0].cards.length === 2 && (me.hands[0].status === "playing" || me.hands[0].status === "blackjack")

  return (
    <>
      <div className={styles.topBar}>
        <p className={styles.info}>
          {table.players.length} spiller{table.players.length === 1 ? "" : "e"} · Buy-in: {table.buyIn}
          {table.iAmPlaying ? (playingPotMoney ? ` · Pott-penger igjen: ${table.myPotBankroll}` : ` · Dine chips: ${table.myChips}`) : ""}
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
                <span className={styles.playerIdentity}>
                  <img className={styles.avatar} src={proxyImageUrl(p.avatar)} alt="" />
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

      <SpectatorBar spectators={table.spectators} />

      {error && <p className={styles.error}>{error}</p>}

      {table.iAmPlaying && discordUser && table.potRefunds?.[discordUser.id] && (
        <p className={styles.info}>
          Siden du prøvde å gamble en deathroll-pott, er {table.potRefunds[discordUser.id]} chips lagt tilbake i potten.
        </p>
      )}

      {table.iAmPlaying && table.status === "roundOver" && table.myGotRedealBonus && (
        <p className={styles.info}>🎁 Du vant med pott-innsatsen og fikk +1 "Deal på ny"!</p>
      )}

      {table.iAmSpectating && <p className={styles.info}>Du ser på - ikke med i spillet.</p>}

      {table.iAmPlaying && iAmSittingOut && !playingPotMoney && (
        <p className={styles.info}>Du har ikke nok chips til denne runden - blir med igjen automatisk neste runde du har råd til.</p>
      )}

      {table.iAmPlaying && playingPotMoney && mySpendable < table.buyIn && table.status !== "playing" && (
        <div className={styles.voteBanner}>
          <p className={styles.info}>
            {mySpendable <= 0 ? "Pott-pengene er brukt opp." : `Du har bare ${mySpendable} pott-penger igjen - ikke nok til buy-in på ${table.buyIn}.`} Vil du spille
            videre med dine egne chips?
          </p>
          <button className={styles.redealBtn} type="button" disabled={busy} onClick={() => action("ownChips")}>
            Spill videre med egne chips
          </button>
        </div>
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

      {table.iAmPlaying && !table.redealVote && !iAmSittingOut && canRedeal && table.status === "playing" && table.myRedealsAvailable > 0 && !table.myRedealDeniedThisRound && (
        <button className={styles.redealBtn} type="button" disabled={busy} onClick={() => action("requestRedeal")}>
          🔄 Deal på ny ({table.myRedealsAvailable})
        </button>
      )}

      {table.iAmPlaying && !table.redealVote && !iAmSittingOut && canRedeal && table.status === "playing" && table.myRedealsAvailable > 0 && table.myRedealDeniedThisRound && (
        <p className={styles.info}>"Deal på ny" ble avvist denne runden - prøv igjen neste runde.</p>
      )}

      {table.iAmPlaying && table.betVote && (
        <div className={styles.voteBanner}>
          <p className={styles.info}>
            <strong>{table.betVote.requestedByUsername}</strong> vil heve buy-in til <strong>{table.betVote.proposedBuyIn}</strong> chips - {table.betVote.yesCount}/
            {table.betVote.totalNeeded} har stemt ja.
          </p>
          {table.betVote.myVoted ? (
            <p className={styles.info}>Venter på de andre...</p>
          ) : (
            <div className={styles.actionRow}>
              <button className={styles.hitBtn} type="button" disabled={busy} onClick={() => action("voteBet", { approve: true })}>
                Ja
              </button>
              <button className={styles.standBtn} type="button" disabled={busy} onClick={() => action("voteBet", { approve: false })}>
                Nei
              </button>
            </div>
          )}
        </div>
      )}

      {canAdjustBet && (
        <div className={styles.startRow}>
          <input
            className={styles.buyInInput}
            type="number"
            min={0}
            step={1}
            value={betInput}
            placeholder={String(table.buyIn)}
            onChange={(e) => setBetInput(e.target.value)}
            aria-label="Ny buy-in i chips"
          />
          <button
            className={styles.dealBtn}
            type="button"
            disabled={busy || betInput === ""}
            onClick={() => {
              action("setBet", { buyIn: Number(betInput) || 0 })
              setBetInput("")
            }}
          >
            Sett satsing
          </button>
          <button className={styles.redealBtn} type="button" disabled={busy || mySpendable <= 0} onClick={() => action("setBet", { allIn: true })}>
            All in ({mySpendable})
          </button>
        </div>
      )}

      {canAct && advice && <BlackjackAdvice advice={advice} />}

      {canAct && (
        <div className={styles.actionRow}>
          <button className={`${styles.hitBtn} ${advice?.move === "hit" ? adviceStyles.recommended : ""}`} type="button" disabled={busy} onClick={() => action("hit")}>
            Hit
          </button>
          <button className={`${styles.standBtn} ${advice?.move === "stand" ? adviceStyles.recommended : ""}`} type="button" disabled={busy} onClick={() => action("stand")}>
            Stand
          </button>
          {canDouble && (
            <button className={`${styles.doubleBtn} ${advice?.move === "double" ? adviceStyles.recommended : ""}`} type="button" disabled={busy} onClick={() => action("double")}>
              Double
            </button>
          )}
          {canSplit && (
            <button className={`${styles.splitBtn} ${advice?.move === "split" ? adviceStyles.recommended : ""}`} type="button" disabled={busy} onClick={() => action("split")}>
              Split
            </button>
          )}
        </div>
      )}

      {!canAct && table.iAmPlaying && table.status !== "playing" && table.players.length > 0 && (
        <button className={styles.dealBtn} type="button" disabled={busy || !canDeal} onClick={() => action("deal")}>
          {dealCooldownMs > 0 ? `Nytt parti (${Math.ceil(dealCooldownMs / 1000)}s)` : "Nytt parti"}
        </button>
      )}

      <GameChat
        messages={table.chat ?? []}
        boldUserId={table.hostId}
        post={(text) => postChatTo("/api/multiplayer/blackjack", accessToken, { instanceId, lobbyId, action: "chat", text })}
        onPosted={(chat) => {
          shownRef.current.chatAt = chat.at(-1)?.at
          setTable((prev) => (prev ? { ...prev, chat } : prev))
        }}
      />
    </>
  )
}
