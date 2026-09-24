"use client"

import { callApi } from "@/lib/apiClient"
import { proxyImageUrl } from "@/lib/imgProxy"
import { useDiscord } from "@/providers/discordProvider"
import { useEffect, useRef, useState } from "react"
import shared from "./BlackjackGame.module.css"
import styles from "./RouletteGame.module.css"
import { SpectatorBar } from "./SpectatorBar"

type BetType = "number" | "red" | "black" | "even" | "odd"

interface BetView {
  key: string
  type: BetType
  value?: number
  stake: number
}

interface PlayerView {
  id: string
  username: string
  avatar: string
  bets: BetView[]
  staked: number
  ready: boolean
}

interface TableView {
  roundId: number
  phase: "betting" | "result"
  msLeft: number
  winningNumber?: number
  results?: Record<string, { name: string; staked: number; returned: number; net: number }>
  history: number[]
  myChips: number
  myBets: BetView[]
  players: PlayerView[]
  ready: { count: number; total: number; iAmReady: boolean }
  config: { spinMs: number; spinDelayMs: number; holdMs: number; resultMs: number; bettingMs: number; minBet: number }
}

// Same numbers as rouletteValues.red on the server - only used for colouring here, never for deciding an outcome.
const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
/** Pocket order around a European wheel, clockwise from 0. */
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const STEP = 360 / WHEEL_ORDER.length
const STAKE_PRESETS = [10, 50, 100, 500, 1000]

const colorOf = (n: number): "green" | "red" | "black" => (n === 0 ? "green" : RED.includes(n) ? "red" : "black")
const colorName = { green: "grønn", red: "rød", black: "svart" }
const fmt = (n: number) => n.toLocaleString("nb-NO")
const OUTSIDE: { type: BetType; label: string; className: string }[] = [
  { type: "red", label: "Rød", className: "red" },
  { type: "black", label: "Svart", className: "black" },
  { type: "even", label: "Partall", className: "plain" },
  { type: "odd", label: "Oddetall", className: "plain" },
]
const betLabel = (b: { type: BetType; value?: number }) => (b.type === "number" ? String(b.value) : OUTSIDE.find((o) => o.type === b.type)!.label)
const spotKey = (type: BetType, value?: number) => (type === "number" ? `n:${value}` : type)

function polar(radius: number, degrees: number): [number, number] {
  const a = ((degrees - 90) * Math.PI) / 180
  return [radius * Math.cos(a), radius * Math.sin(a)]
}

interface SpinPlan {
  id: number
  winning: number
  /** Where the wheel was resting before this spin - the animation starts from it so nothing jumps. */
  fromAngle: number
  startAt: number
  durationMs: number
  /** When this result arrived (the wheel grows here) and when the wheel may shrink back again. */
  resultStartAt: number
  holdEndAt: number
}

const TRACK_R = 120 // the rim the ball races around
const REST_R = 107 // where it sits once it's in a pocket
const BALL_TURNS = 9 // full laps the ball makes relative to the wheel, against its direction
const BALL_SLOWDOWN = 1.7 // how sharply it slows: higher = spends longer crawling at the end
const WHEEL_EXTRA_TURNS = 3
const DROP_AT = 0.58 // the ball leaves the rim...
const SETTLE_AT = 0.8 // ...is over the pockets from here - still moving, crossing a good number of them - and then hops to a stop

/** Where a wheel comes to rest for a number. Depends only on the number, so a wheel that's just been opened looks the same as
 * one that's been watched all along - and the next spin can start exactly from it. */
const restAngle = (n: number) => (n * 137.508) % 360
/** The centre of a number's pocket, measured on the wheel itself. */
const pocketAngle = (n: number) => (WHEEL_ORDER.indexOf(n) + 0.5) * STEP

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => x * x * (3 - 2 * x)

/** The wheel and the ball at time t (0..1) through a spin. The wheel turns clockwise and slows; the ball goes round the rim the
 * other way, slows more, drops in, hops between a few pockets and settles in the winning one. Deterministic in t, so every copy
 * of the wheel (and every player's screen) shows the same thing. Angles are degrees clockwise from the top. */
function poseAt(plan: SpinPlan, t: number) {
  const tt = clamp01(t)
  const wheelTravel = ((((restAngle(plan.winning) - plan.fromAngle) % 360) + 360) % 360) + 360 * WHEEL_EXTRA_TURNS
  const wheel = plan.fromAngle + wheelTravel * (1 - Math.pow(1 - tt, 2.2))

  // Ball angle on the wheel: counts down to the winning pocket, so relative to the wheel it runs against the spin. It's still
  // travelling at a fair speed when it leaves the rim (a couple of hundred degrees a second) and crosses a dozen-odd pockets on the
  // way down - it isn't already sitting on the winner - which is what stops the landing looking pre-arranged.
  let phi = pocketAngle(plan.winning) + BALL_TURNS * 360 * Math.pow(1 - tt, BALL_SLOWDOWN)
  let radius = TRACK_R
  if (tt > DROP_AT) radius = TRACK_R + (REST_R - TRACK_R) * smooth(clamp01((tt - DROP_AT) / (SETTLE_AT - DROP_AT)))
  if (tt > SETTLE_AT) {
    // Out of steam: it clatters past the winner by a pocket or so, hops back, and stops - one and a half swings, dying away, plus a
    // couple of small bounces. Both start and end at exactly zero, so nothing snaps.
    const s = (tt - SETTLE_AT) / (1 - SETTLE_AT)
    phi += Math.pow(1 - s, 1.5) * STEP * 1.3 * Math.sin(s * Math.PI * 3)
    radius -= Math.pow(1 - s, 2) * 2.5 * Math.abs(Math.sin(s * Math.PI * 2))
  }
  return { wheel, ball: wheel + phi, radius }
}

function restPose(n: number) {
  const wheel = restAngle(n)
  return { wheel, ball: wheel + pocketAngle(n), radius: REST_R }
}

/** The wheel. It animates itself frame by frame (through refs, so React isn't re-rendering 37 pockets at 60fps) whenever it's given
 * a new spin plan, and otherwise just rests with the ball in the last winning pocket. */
function Wheel({ plan, restNumber, className }: { plan: SpinPlan | null; restNumber: number | null; className: string }) {
  const wheelRef = useRef<SVGGElement>(null)
  const ballRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const draw = (pose: { wheel: number; ball: number; radius: number } | null) => {
      const wheel = wheelRef.current
      const ball = ballRef.current
      if (!wheel || !ball) return
      if (!pose) {
        ball.style.display = "none"
        return
      }
      wheel.style.transform = `rotate(${pose.wheel}deg)`
      const a = (pose.ball * Math.PI) / 180
      ball.setAttribute("cx", String(pose.radius * Math.sin(a)))
      ball.setAttribute("cy", String(-pose.radius * Math.cos(a)))
      ball.style.display = "block"
    }

    if (!plan) {
      draw(restNumber === null ? null : restPose(restNumber))
      return
    }
    let raf = 0
    const frame = () => {
      const t = (Date.now() - plan.startAt) / plan.durationMs
      draw(poseAt(plan, t))
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [plan, restNumber])

  return (
    <div className={`${styles.wheelWrap} ${className}`}>
      <svg viewBox="-125 -125 250 250" className={styles.wheel} aria-hidden="true">
        <circle r="120" className={styles.track} />
        <g ref={wheelRef} style={{ transformOrigin: "0 0" }}>
          {WHEEL_ORDER.map((n, i) => {
            const [x1, y1] = polar(116, i * STEP)
            const [x2, y2] = polar(116, (i + 1) * STEP)
            const [x3, y3] = polar(78, (i + 1) * STEP)
            const [x4, y4] = polar(78, i * STEP)
            const [tx, ty] = polar(98, (i + 0.5) * STEP)
            return (
              <g key={n}>
                <path d={`M${x1} ${y1} A116 116 0 0 1 ${x2} ${y2} L${x3} ${y3} A78 78 0 0 0 ${x4} ${y4} Z`} className={styles[`pocket_${colorOf(n)}`]} />
                <text x={tx} y={ty} className={styles.pocketLabel} transform={`rotate(${(i + 0.5) * STEP} ${tx} ${ty})`}>
                  {n}
                </text>
              </g>
            )
          })}
          <circle r="70" className={styles.wheelHub} />
          <circle r="34" className={styles.wheelHubInner} />
        </g>
        <circle ref={ballRef} r="4.6" className={styles.ball} style={{ display: "none" }} />
      </svg>
    </div>
  )
}

export function RouletteGame({ accessToken }: { accessToken: string }) {
  const { instanceId, discordUser } = useDiscord()
  const [table, setTable] = useState<TableView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [stake, setStake] = useState("100")
  const [now, setNow] = useState(0)
  const [deadline, setDeadline] = useState(0)
  const [plan, setPlan] = useState<SpinPlan | null>(null)
  /** Balance shown while the wheel is still turning - the server's has the payout in it already, which would give the result away. */
  const [frozenChips, setFrozenChips] = useState<number | null>(null)

  const nowRef = useRef(0)
  const tableRef = useRef<TableView | null>(null)
  const busyRef = useRef(false)
  const animatedRoundRef = useRef<number | null>(null)

  function applyTable(res: TableView) {
    const previous = tableRef.current
    tableRef.current = res
    setDeadline(nowRef.current + res.msLeft)

    // A new result: lay out the whole show against the moment the result actually happened on the server (not when this poll
    // happened to arrive) - the wheel grows, pauses, the ball spins, holds on the winner, and shrinks. Someone who opens the page
    // partway through joins mid-spin (or, if it's over, just sees the wheel at rest with the ball in the winning pocket).
    if (res.phase === "result" && res.winningNumber !== undefined && res.roundId !== animatedRoundRef.current) {
      animatedRoundRef.current = res.roundId
      const c = res.config
      const resultStartAt = nowRef.current - (c.resultMs - res.msLeft)
      const startAt = resultStartAt + c.spinDelayMs
      const previousWinner = res.history[res.history.length - 2]
      setPlan({
        id: res.roundId,
        winning: res.winningNumber,
        fromAngle: previousWinner === undefined ? 0 : restAngle(previousWinner),
        startAt,
        durationMs: c.spinMs,
        resultStartAt,
        holdEndAt: startAt + c.spinMs + c.holdMs,
      })
      setFrozenChips(nowRef.current < startAt + c.spinMs ? previous?.myChips ?? null : null)
    }
    setTable(res)
  }

  useEffect(() => {
    if (!instanceId) return
    nowRef.current = Date.now()
    setNow(nowRef.current)
    let cancelled = false
    const url = `/api/multiplayer/roulette?instanceId=${encodeURIComponent(instanceId)}`
    const load = () =>
      callApi<TableView>(url, accessToken)
        .then((res) => {
          if (!cancelled && !busyRef.current) applyTable(res)
        })
        .catch(() => {
          // transient poll failure - next tick retries
        })
    const first = setTimeout(load, 0)
    const poll = setInterval(load, 1000)
    const tick = setInterval(() => {
      nowRef.current = Date.now()
      setNow(nowRef.current)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(first)
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [instanceId, accessToken])

  async function act(body: Record<string, unknown>) {
    if (!instanceId || busy) return
    setBusy(true)
    busyRef.current = true
    setError(null)
    try {
      applyTable(await callApi<TableView>("/api/multiplayer/roulette", accessToken, { method: "POST", body: JSON.stringify({ instanceId, ...body }) }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt")
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }

  if (!instanceId) return <p className={shared.info}>Multiplayer krever at appen åpnes som en Discord Activity i en talekanal.</p>
  if (!table) return <p className={shared.info}>{error ?? "Kobler til bordet..."}</p>

  const myId = discordUser?.id
  const spinning = !!plan && plan.id === table.roundId && now < plan.startAt + plan.durationMs
  const ballLaunched = !!plan && now >= plan.startAt
  // The wheel is out from the moment the result arrives until a moment after the ball has settled - nothing can be bet then anyway.
  const wheelExpanded = table.phase === "result" && !!plan && plan.id === table.roundId && now >= plan.resultStartAt && now < plan.holdEndAt
  const restNumber = table.history.length > 0 ? table.history[table.history.length - 1] : null
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000))
  const bettingOpen = table.phase === "betting" && secondsLeft > 0
  const stakeNumber = Math.floor(Number(stake))
  const validStake = stakeNumber >= table.config.minBet
  const totalStaked = table.players.reduce((sum, p) => sum + p.staked, 0)
  const myTotals = new Map<string, number>()
  for (const b of table.myBets) myTotals.set(spotKey(b.type, b.value), (myTotals.get(spotKey(b.type, b.value)) ?? 0) + b.stake)
  const myStakeTotal = table.myBets.reduce((sum, b) => sum + b.stake, 0)
  // Everyone at the table can bet - the ones who haven't are just watching, and get the same "ser på" bar as in the other games.
  const bettors = table.players.filter((p) => p.bets.length > 0)
  const watchers = table.players.filter((p) => p.bets.length === 0)

  // While the wheel is turning the newest number is the answer - keep it out of the history until it lands.
  const history = table.phase === "result" && spinning ? table.history.slice(0, -1) : table.history
  const showResult = table.phase === "result" && !spinning && table.winningNumber !== undefined
  const myResult = myId && showResult ? table.results?.[myId] : undefined
  const chips = spinning && frozenChips !== null ? frozenChips : table.myChips

  let status = ""
  if (table.phase === "betting") {
    if (totalStaked === 0) status = "Legg en innsats - runden spinner når tiden er ute"
    else if (table.ready.total > 0 && table.ready.count === table.ready.total) status = "Alle er klare - spinner..."
    else status = secondsLeft > 0 ? `Innsatser stenger om ${secondsLeft}s` : "Spinner..."
  } else status = spinning ? (ballLaunched ? "Ballen ruller..." : "Spinner...") : "Neste runde åpner snart"

  const spot = (type: BetType, value?: number) => {
    const total = myTotals.get(spotKey(type, value))
    return (
      <>
        {type === "number" ? value : OUTSIDE.find((o) => o.type === type)!.label}
        {total ? <span className={styles.badge}>{fmt(total)}</span> : null}
      </>
    )
  }
  const bet = (type: BetType, value?: number) => act({ action: "bet", type, value, stake: stakeNumber })
  const canBet = bettingOpen && validStake && !busy

  return (
    <>
      <div className={shared.topBar}>
        <p className={shared.info}>
          Dine chips: <strong>{fmt(chips)}</strong>
        </p>
      </div>

      <div className={`${styles.stage} ${wheelExpanded ? styles.stageOpen : ""}`} aria-hidden={!wheelExpanded}>
        <Wheel plan={plan} restNumber={restNumber} className={styles.wheelBig} />
      </div>

      <div className={styles.top}>
        <Wheel plan={plan} restNumber={restNumber} className={`${styles.wheelCompact} ${wheelExpanded ? styles.wheelCompactHidden : ""}`} />
        <div className={styles.topInfo}>
          <div className={styles.statusBar}>
            {showResult ? (
              <div className={styles.resultRow}>
                <span className={`${styles.resultNumber} ${styles[`num_${colorOf(table.winningNumber as number)}`]}`}>{table.winningNumber}</span>
                <span>
                  <strong>{colorName[colorOf(table.winningNumber as number)]}</strong>
                  {myResult && (
                    <>
                      {" · "}
                      {myResult.net >= 0 ? (
                        <span className={styles.win}>Du vant {fmt(myResult.net)} chips 💰</span>
                      ) : (
                        <span className={styles.loss}>Du tapte {fmt(-myResult.net)} chips 💸</span>
                      )}
                    </>
                  )}
                </span>
              </div>
            ) : (
              status
            )}
          </div>

          <div className={styles.history}>
            {history.map((n, i) => (
              <span key={`${i}-${n}`} className={`${styles.historyDot} ${styles[`num_${colorOf(n)}`]}`}>
                {n}
              </span>
            ))}
          </div>

          {table.phase === "betting" && (
            <button
              className={`${shared.dealBtn} ${styles.spinBtn}`}
              type="button"
              disabled={!bettingOpen || busy || table.myBets.length === 0 || table.ready.iAmReady}
              onClick={() => act({ action: "spin" })}
            >
              {table.ready.iAmReady ? "Klar" : "Spin"} ({table.ready.count}/{table.ready.total})
            </button>
          )}
        </div>
      </div>

      <div className={styles.stakeRow}>
        <input
          className={`${shared.buyInInput} ${styles.stakeInput}`}
          type="number"
          min={table.config.minBet}
          step={1}
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          aria-label="Innsats i chips"
        />
        {STAKE_PRESETS.map((p) => (
          <button key={p} type="button" className={`${styles.presetBtn} ${stakeNumber === p ? styles.presetActive : ""}`} onClick={() => setStake(String(p))}>
            {fmt(p)}
          </button>
        ))}
        <button type="button" className={styles.presetBtn} onClick={() => setStake(String(table.myChips))} disabled={table.myChips <= 0}>
          Alt
        </button>
      </div>

      <div className={styles.board}>
        <button type="button" className={`${styles.cell} ${styles.zero}`} disabled={!canBet} onClick={() => bet("number", 0)}>
          {spot("number", 0)}
        </button>
        {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={`${styles.cell} ${styles[`cell_${colorOf(n)}`]}`} disabled={!canBet} onClick={() => bet("number", n)}>
            {spot("number", n)}
          </button>
        ))}
      </div>

      <div className={styles.outside}>
        {OUTSIDE.map((o) => (
          <button key={o.type} type="button" className={`${styles.cell} ${styles[`outside_${o.className}`]}`} disabled={!canBet} onClick={() => bet(o.type)}>
            {spot(o.type)}
          </button>
        ))}
      </div>

      <p className={`${shared.info} ${styles.hint}`}>
        Tall betaler {fmt(36)}x, rød/svart/partall/oddetall betaler 2x. Trykk på et felt for å legge innsatsen din der.
      </p>
      {error && <p className={shared.error}>{error}</p>}

      {myStakeTotal > 0 && bettingOpen && (
        <button className={`${shared.redealBtn} ${styles.clearBtn}`} type="button" disabled={busy} onClick={() => act({ action: "clear" })}>
          Ta tilbake mine innsatser ({fmt(myStakeTotal)})
        </button>
      )}

      <SpectatorBar spectators={watchers} />

      <div className={styles.players}>
        <span className={shared.label}>Innsatser</span>
        {bettors.length === 0 && <span className={shared.info}>Ingen innsatser ennå</span>}
        {bettors.map((p) => {
          const r = showResult ? table.results?.[p.id] : undefined
          return (
            <div key={p.id} className={`${styles.player} ${p.id === myId ? styles.playerMe : ""}`}>
              <img className={shared.avatar} src={proxyImageUrl(p.avatar)} alt="" />
              <span className={styles.playerName}>
                {p.username}
                {p.ready && table.phase === "betting" ? " ✓" : ""}
              </span>
              <span className={styles.playerBets}>
                {p.bets.map((b) => (
                  <span key={b.key} className={styles.betTag}>
                    {betLabel(b)} <em>{fmt(b.stake)}</em>
                  </span>
                ))}
              </span>
              {r && (
                <span className={r.net >= 0 ? styles.win : styles.loss}>
                  {r.net >= 0 ? "+" : "-"}
                  {fmt(Math.abs(r.net))}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
