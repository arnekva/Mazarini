"use client"

import { callApi } from "@/lib/apiClient"
import Link from "next/link"
import { useDiscord } from "@/providers/discordProvider"
import { useEffect, useRef, useState } from "react"
import shared from "./BlackjackGame.module.css"
import styles from "./DondGame.module.css"
import { Spectator, SpectatorBar } from "./SpectatorBar"

type Tier = "basic" | "premium" | "elite"

interface GameView {
  tier: Tier
  k: number
  state: "opening" | "offer" | "keepOrSwitch" | "done"
  round: number
  casesToOpen: number
  playerCase: number
  board: { value: number; eliminated: boolean }[]
  cases: { nr: number; opened: boolean; value?: number; mine: boolean }[]
  offer?: { kind: "chips"; amount: number } | { kind: "effect"; id: string; label: string }
  otherCase?: number
  result?: { outcome: "deal" | "kept" | "switched"; chips?: number; effectLabel?: string; playerCaseValue: number; otherCaseValue?: number }
}

interface ChatMessage {
  userId: string
  name: string
  text: string
  at: number
}

interface ActiveGame {
  hostId: string
  playerName: string
  k: number
  round: number
  state: string
}

interface Status {
  tokens: Record<Tier, number>
  game: GameView | null
  /** Whose round this is (the player's user id) - the chat belongs to it, and the player's lines are bold. */
  hostId?: string
  chat?: ChatMessage[]
  /** Names of everyone currently watching this round. */
  spectators?: Spectator[]
  /** Only when spectating someone else's round. */
  playerName?: string | null
}

const TIERS: { tier: Tier; label: string }[] = [
  { tier: "basic", label: "10K" },
  { tier: "premium", label: "20K" },
  { tier: "elite", label: "50K" },
]

const NUM_CASES = 26

const fmt = (n: number) => n.toLocaleString("nb-NO")

const WATCH_POLL_MS = 1500
const PLAYER_POLL_MS = 2500

/** Bare-bones round chat: a scrollable log (sticks to the bottom unless you've scrolled up to read) and an input. */
function DondChat({
  messages,
  hostId,
  draft,
  onDraft,
  onSend,
  busy,
}: {
  messages: ChatMessage[]
  hostId?: string
  draft: string
  onDraft: (value: string) => void
  onSend: () => void
  busy: boolean
}) {
  const logRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  useEffect(() => {
    const el = logRef.current
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages.length])

  return (
    <div className={styles.chat}>
      <div
        ref={logRef}
        className={styles.chatLog}
        onScroll={() => {
          const el = logRef.current
          if (el) stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
      >
        {messages.length === 0 && <span className={styles.chatEmpty}>Ingen meldinger ennå</span>}
        {messages.map((m, i) => (
          <div key={`${m.at}-${i}`} className={styles.chatLine}>
            {m.userId === hostId ? <strong>{m.name}</strong> : m.name}: {m.text}
          </div>
        ))}
      </div>
      <form
        className={styles.chatForm}
        onSubmit={(e) => {
          e.preventDefault()
          onSend()
        }}
      >
        <input className={styles.chatInput} value={draft} maxLength={200} placeholder="Skriv en melding..." onChange={(e) => onDraft(e.target.value)} />
        <button className={styles.chatSend} type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}

/** `watchId` set = spectating that user's round: read-only, polled, no token/start UI. */
export function DondGame({ accessToken, watchId }: { accessToken: string; watchId?: string }) {
  const readOnly = !!watchId
  const [status, setStatus] = useState<Status | null>(null)
  const [tier, setTier] = useState<Tier | null>(null)
  const [pickedCase, setPickedCase] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [chatDraft, setChatDraft] = useState("")
  const [chatBusy, setChatBusy] = useState(false)
  const loadedRef = useRef(false)
  // Mirrors `busy` for the poll below - its interval callback would otherwise only ever see a stale value.
  const busyRef = useRef(false)
  // Bumped when an action starts and again when it finishes. A poll remembers the value it started under and is thrown away if it moved
  // meanwhile: otherwise a poll sent just before "No deal" (or before a case opened) can land just after the action's own answer and
  // put the old screen back for a moment - the Deal button vanishing and reappearing.
  const actSeqRef = useRef(0)
  const { channelId } = useDiscord()
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([])

  // While you're between rounds, keep a list of rounds in progress to watch (so the announcement button isn't the only way in).
  const browsing = !readOnly && !!status && !status.game
  useEffect(() => {
    if (!browsing) return
    let cancelled = false
    const load = () =>
      callApi<{ games: ActiveGame[] }>("/api/games/dond?active=1", accessToken)
        .then((res) => {
          if (!cancelled) setActiveGames(res.games)
        })
        .catch(() => {
          // transient failure - next tick retries
        })
    const first = setTimeout(load, 0)
    const interval = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearTimeout(first)
      clearInterval(interval)
    }
  }, [browsing, accessToken])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    callApi<Status>(watchId ? `/api/games/dond?watch=${encodeURIComponent(watchId)}` : "/api/games/dond", accessToken)
      .then((res) => setStatus((prev) => ({ ...res, tokens: res.tokens ?? prev?.tokens ?? { basic: 0, premium: 0, elite: 0 } })))
      .catch((e) => setError(e instanceof Error ? e.message : "Noe gikk galt"))
  }, [accessToken, watchId])

  // Spectators follow the round live; the player polls too while a round exists, to pick up chat messages.
  // A poll never overwrites the screen while one of the player's own actions is in flight.
  const roundExists = !!status?.game
  useEffect(() => {
    if (!watchId && !roundExists) return
    const url = watchId ? `/api/games/dond?watch=${encodeURIComponent(watchId)}` : "/api/games/dond"
    const interval = setInterval(
      () => {
        if (busyRef.current) return
        const seq = actSeqRef.current
        callApi<Status>(url, accessToken)
          .then((res) => {
            if (busyRef.current || actSeqRef.current !== seq) return
            setStatus((prev) => ({ ...res, tokens: res.tokens ?? prev?.tokens ?? { basic: 0, premium: 0, elite: 0 } }))
          })
          .catch(() => {
            // transient poll failure - next tick retries
          })
      },
      watchId ? WATCH_POLL_MS : PLAYER_POLL_MS
    )
    return () => clearInterval(interval)
  }, [accessToken, watchId, roundExists])

  async function act(body: Record<string, unknown>) {
    if (busy) return
    setBusy(true)
    busyRef.current = true
    actSeqRef.current++
    setError(null)
    try {
      const res = await callApi<Partial<Status>>("/api/games/dond", accessToken, { method: "POST", body: JSON.stringify(body) })
      setStatus((prev) => ({
        ...prev,
        tokens: res.tokens ?? prev?.tokens ?? { basic: 0, premium: 0, elite: 0 },
        game: "game" in res ? res.game ?? null : prev?.game ?? null,
        // A finished round's chat is dropped along with the round (the recap post already has it).
        ...(("game" in res ? res.game : prev?.game) ? {} : { chat: [] }),
      }))
      if (body.action === "start") setPickedCase(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt")
    } finally {
      setBusy(false)
      busyRef.current = false
      actSeqRef.current++
    }
  }

  async function sendChat() {
    const text = chatDraft.trim()
    const hostId = status?.hostId ?? watchId
    if (!text || !hostId || chatBusy) return
    setChatBusy(true)
    try {
      const res = await callApi<{ chat: ChatMessage[] }>("/api/games/dond", accessToken, {
        method: "POST",
        body: JSON.stringify({ action: "chat", hostId, text }),
      })
      setStatus((prev) => (prev ? { ...prev, chat: res.chat } : prev))
      setChatDraft("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt")
    } finally {
      setChatBusy(false)
    }
  }

  if (!status) return <p className={shared.info}>{error ?? "Laster..."}</p>

  const game = status.game

  if (readOnly && !game) {
    return <p className={shared.info}>{status.playerName ? `${status.playerName} har ingen aktiv runde akkurat nå.` : "Fant ingen aktiv runde."}</p>
  }

  // ---------- No game running: pick tier + your case ----------
  if (!game) {
    const owned = TIERS.filter((t) => status.tokens[t.tier] > 0)
    const activeTier = tier && status.tokens[tier] > 0 ? tier : owned[0]?.tier ?? null

    return (
      <>
        <p className={shared.info}>Hver runde koster en Deal or No Deal-token. Du får dem som reward.</p>
        <div className={styles.tokenRow}>
          {TIERS.map((t) => (
            <button
              key={t.tier}
              type="button"
              className={`${styles.tokenBtn} ${activeTier === t.tier ? styles.tokenBtnActive : ""}`}
              disabled={status.tokens[t.tier] <= 0}
              onClick={() => setTier(t.tier)}
            >
              <strong>{t.label}</strong>
              <span>
                {status.tokens[t.tier]} token{status.tokens[t.tier] === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>

        {owned.length === 0 ? (
          <p className={shared.info}>Du har ingen tokens akkurat nå.</p>
        ) : (
          <>
            <p className={shared.info}>Velg kofferten din:</p>
            <div className={styles.caseGrid}>
              {Array.from({ length: NUM_CASES }, (_, i) => i + 1).map((nr) => (
                <button key={nr} type="button" className={`${styles.case} ${pickedCase === nr ? styles.caseMine : ""}`} onClick={() => setPickedCase(nr)}>
                  {nr}
                </button>
              ))}
            </div>
            <button
              className={`${shared.dealBtn} ${styles.compactBtn}`}
              style={{ width: "100%", marginTop: 12 }}
              type="button"
              disabled={busy || !activeTier || pickedCase === null}
              onClick={() => act({ action: "start", tier: activeTier, caseNr: pickedCase, channelId })}
            >
              {pickedCase === null ? "Velg en koffert" : `Start spillet med koffert ${pickedCase}`}
            </button>
          </>
        )}
        {activeGames.length > 0 && (
          <div className={styles.activeList}>
            <p className={shared.info}>Pågående runder - klikk for å se på:</p>
            {activeGames.map((g) => (
              <Link key={g.hostId} className={styles.activeRow} href={`/dond?watch=${encodeURIComponent(g.hostId)}`}>
                <strong>{g.playerName}</strong>
                <span>
                  {g.k}K · runde {g.round}
                </span>
                <span>👁 Se på</span>
              </Link>
            ))}
          </div>
        )}
        {error && <p className={shared.error}>{error}</p>}
      </>
    )
  }

  // ---------- Game in progress / finished ----------
  const half = Math.ceil(game.board.length / 2)
  const columns = [game.board.slice(0, half), game.board.slice(half)]

  return (
    <>
      {readOnly && (
        <p className={shared.info}>
          👁 Du ser på {status.playerName ?? "en annen spiller"} sin runde - {game.k}K
        </p>
      )}
      <div className={styles.banker}>
        {game.state === "opening" && (
          <>
            <strong>Runde {game.round}</strong> — åpne {game.casesToOpen} koffert{game.casesToOpen === 1 ? "" : "er"}
          </>
        )}
        {game.state === "offer" && game.offer && (
          <>
            <strong>{readOnly ? "Bank Høie tilbyr" : "Bank Høie tilbyr deg"}</strong>
            <div className={styles.offer}>{game.offer.kind === "chips" ? `${fmt(game.offer.amount)} chips` : game.offer.label}</div>
            {game.offer.kind === "effect" && <span className={shared.info}>En effekt i stedet for chips.</span>}
            {readOnly ? (
              <span className={shared.info}>Venter på at {status.playerName ?? "spilleren"} svarer...</span>
            ) : (
              <div className={shared.actionRow}>
                <button className={`${shared.hitBtn} ${styles.compactBtn}`} type="button" disabled={busy} onClick={() => act({ action: "offer", deal: true })}>
                  Deal
                </button>
                <button
                  className={`${shared.standBtn} ${styles.compactBtn}`}
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: "offer", deal: false })}
                >
                  No deal
                </button>
              </div>
            )}
          </>
        )}
        {game.state === "keepOrSwitch" && (
          <>
            <strong>Bare to kofferter igjen</strong> — {readOnly ? "spillerens" : "din"} nr {game.playerCase}, og nr {game.otherCase}. Beholde eller bytte?
            {readOnly ? (
              <span className={shared.info}>Venter på at {status.playerName ?? "spilleren"} velger...</span>
            ) : (
              <div className={shared.actionRow}>
                <button
                  className={`${shared.hitBtn} ${styles.compactBtn}`}
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: "keepOrSwitch", doSwitch: false })}
                >
                  Behold
                </button>
                <button
                  className={`${shared.splitBtn} ${styles.compactBtn}`}
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: "keepOrSwitch", doSwitch: true })}
                >
                  Bytt
                </button>
              </div>
            )}
          </>
        )}
        {game.state === "done" && game.result && (
          <>
            <strong>
              {game.result.outcome === "deal"
                ? "Deal!"
                : game.result.outcome === "switched"
                ? readOnly
                  ? "Byttet koffert"
                  : "Du byttet koffert"
                : readOnly
                ? "Beholdt kofferten"
                : "Du beholdt kofferten"}
            </strong>
            <div className={styles.offer}>{game.result.effectLabel ?? `${fmt(game.result.chips ?? 0)} chips`}</div>
            <span className={shared.info}>
              {game.result.outcome === "deal"
                ? `Kofferten din hadde ${fmt(game.result.playerCaseValue)} chips.`
                : `Den andre kofferten hadde ${fmt(game.result.otherCaseValue ?? 0)} chips.`}
            </span>
            {!readOnly && (
              <button
                className={`${shared.dealBtn} ${styles.compactBtn}`}
                style={{ width: "100%", marginTop: 8 }}
                type="button"
                disabled={busy}
                onClick={() => act({ action: "dismiss" })}
              >
                Ferdig
              </button>
            )}
          </>
        )}
      </div>

      <SpectatorBar spectators={status.spectators ?? []} />
      <div className={styles.layout}>
        <div className={styles.board}>
          {columns.map((col, ci) => (
            <div key={ci} className={styles.boardCol}>
              {col.map((b) => (
                <div key={b.value} className={`${styles.boardValue} ${b.eliminated ? styles.boardGone : ""}`}>
                  {fmt(b.value)}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className={styles.caseGrid}>
          {game.cases.map((c) => (
            <button
              key={c.nr}
              type="button"
              className={`${styles.case} ${c.mine ? styles.caseMine : ""} ${c.opened ? styles.caseOpened : ""}`}
              disabled={busy || readOnly || c.mine || c.opened || game.state !== "opening"}
              onClick={() => act({ action: "open", caseNr: c.nr })}
            >
              {c.opened ? fmt(c.value ?? 0) : c.nr}
            </button>
          ))}
        </div>
      </div>
      <p className={shared.info}>
        {readOnly ? `${status.playerName ?? "Spillerens"} koffert` : "Din koffert"}: nr {game.playerCase}
      </p>
      <DondChat messages={status.chat ?? []} hostId={status.hostId ?? watchId} draft={chatDraft} onDraft={setChatDraft} onSend={sendChat} busy={chatBusy} />
      {error && <p className={shared.error}>{error}</p>}
    </>
  )
}
