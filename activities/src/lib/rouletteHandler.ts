import { randomInt } from "node:crypto"
import { increment } from "firebase/database"
import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { discordAvatarUrl } from "./discordAvatar"
import { editLiveMessage, liveLogBody, LiveMessageRef, postLiveMessage, resolveAnnounceChannel } from "./discordMessage"
import { after } from "next/server"
import { chatEmbedFields, ChatMessage, postChat, readChat, readChatTail } from "./gameChat"
import { ANNOUNCE_CHANNEL_ID, rouletteValues } from "./gameValues"

// Shared roulette table - one per voice channel (instanceId), everyone who opens it sits at the same table. Port of the
// bot's /rulett (commands/money/gamblingCommands.ts): same bets, same payouts, same stats - but with timed rounds.
//
// Rounds run on their own: bets are open for a while, then one spin resolves everyone's bets at once, the result stays up,
// and the next round opens. There's no process to drive that, so the table is advanced lazily by whoever polls next, and
// the parts that must happen exactly once are protected by a claim (see FirebaseHelper.claim):
//   - a bet is ONE atomic write that both takes the stake and records the bet, so a bet can't be paid for and lost (or vice versa)
//   - a spin is ONE atomic write that pays every winner and moves the table to "result", after exactly one process wins the claim to do it
// Bets live under bets/{roundId}/{userId}/{key} - one child per bet - so simultaneous bets never overwrite each other.

type BetType = "number" | "red" | "black" | "even" | "odd"
type Phase = "betting" | "result"

interface Bet {
  type: BetType
  value?: number
  stake: number
  name: string
}

interface PlayerResult {
  name: string
  staked: number
  returned: number
  net: number
}

interface Table {
  roundId: number
  phase: Phase
  /** betting: when bets close. result: when the next round opens. */
  endsAt: number
  winningNumber?: number
  history: number[]
  results?: Record<string, PlayerResult>
}

const BET_TYPES: BetType[] = ["number", "red", "black", "even", "odd"]
const HISTORY_LENGTH = 18
/** Someone who hasn't polled for this long is no longer "at the table" in the player list. */
const PRESENCE_VISIBLE_MS = 20 * 1000
/** A presence stamp younger than this isn't rewritten - polls come every second, the stamp only has to stay inside PRESENCE_VISIBLE_MS. */
const PRESENCE_TOUCH_MS = 5 * 1000
/** A spin claim older than this that still hasn't produced a result is presumed dead (crashed request) and can be retried. */
const STALE_CLAIM_MS = 60 * 1000

const root = (instanceId: string) => `other/multiplayerRoulette/${instanceId}`
/** The table's version: goes into every write that changes what the table looks like (as part of that same write), and into
 * every view - clients compare the two to know whether they're behind (see lib/liveSignal.ts). */
const bump = (instanceId: string) => ({ [`${root(instanceId)}/v`]: increment(1) })
const err = (message: string, status = 400) => Response.json({ error: message }, { status })

// ---------- the Discord log message and the chat ----------
//
// Like the blackjack table: one message is posted when the first round of a session is played and edited after every round (see the notes on live
// messages in discordMessage.ts) - so it's up to date however the session ends. There's no "session over" event on serverless, so a session is over
// when nobody has been at the table for a while, which is noticed the next time someone arrives (see endIdleSession). That's also when the chat is dumped.

const chatPath = (instanceId: string) => `${root(instanceId)}/chat`
const sessionPath = (instanceId: string) => `${root(instanceId)}/session`
/** Nobody at the table for this long = the session is over. */
const SESSION_IDLE_MS = 60 * 1000

interface Session {
  /** Where its message goes: the channel the first bettor launched the Activity from (already resolved). */
  channelId: string
  starter: string
  startedAt: number
  logRef?: LiveMessageRef
  rounds?: string[]
}

const fmtChips = (n: number) => n.toLocaleString("nb-NO")

function sessionBody(session: Session, rounds: string[], chat: ChatMessage[], footer?: string) {
  return liveLogBody("Rulett", `**${session.starter}** startet en runde rulett`, rounds, chatEmbedFields(chat), footer)
}

async function readSession(firebase: FirebaseHelper, instanceId: string): Promise<Session | null> {
  const raw = await firebase.getData(sessionPath(instanceId))
  if (!raw) return null
  return { ...raw, ...(raw.rounds ? { rounds: Object.values(raw.rounds) as string[] } : {}) }
}

/** The first bet of a session decides where its message goes. */
async function ensureSession(firebase: FirebaseHelper, instanceId: string, user: AuthenticatedDiscordUser) {
  if (await firebase.getData(sessionPath(instanceId))) return
  const session: Session = { channelId: await resolveAnnounceChannel(user.channelId), starter: user.globalName ?? user.username, startedAt: Date.now() }
  await firebase.updateData({ [sessionPath(instanceId)]: session })
}

function roundText(roundId: number, roll: number, results: Record<string, PlayerResult>): string {
  const lines = [`**Runde ${roundId}:** ${roll} (${colorName[colorOf(roll)]})`]
  for (const r of Object.values(results)) {
    const outcome = r.net > 0 ? `vant ${fmtChips(r.net)}` : r.net < 0 ? `tapte ${fmtChips(-r.net)}` : "gikk i null"
    lines.push(`${r.name} satset ${fmtChips(r.staked)}, og ${outcome}`)
  }
  return lines.join("\n")
}

/** Adds a finished round to the session's message - posting the message first if this is the session's first round. Best-effort. */
async function logRound(firebase: FirebaseHelper, instanceId: string, roundId: number, roll: number, results: Record<string, PlayerResult>) {
  try {
    const session = (await readSession(firebase, instanceId)) ?? { channelId: ANNOUNCE_CHANNEL_ID, starter: Object.values(results)[0]?.name ?? "Noen", startedAt: Date.now() }
    const rounds = [...(session.rounds ?? []), roundText(roundId, roll, results)]
    const chat = await readChat(firebase, chatPath(instanceId))
    const body = sessionBody(session, rounds, chat)
    let logRef = session.logRef
    if (logRef) await editLiveMessage(logRef, body)
    else logRef = (await postLiveMessage(session.channelId, body)) ?? undefined
    await firebase.updateData({ [sessionPath(instanceId)]: JSON.parse(JSON.stringify({ ...session, rounds, ...(logRef ? { logRef } : {}) })) })
  } catch (e) {
    console.error("Roulette log update failed", e)
  }
}

/** When someone (re)arrives at a table that nobody else has been at for a while, the earlier session is over: its message gets a last edit with the
 * chat, and the session and chat are cleared. Only called for someone whose own presence has lapsed, i.e. arriving - not on every poll.
 * `presence` is the table's presence as it was before the caller's own arrival was stamped. Returns whether a session was ended. */
async function endIdleSession(firebase: FirebaseHelper, instanceId: string, presence: Presence): Promise<boolean> {
  const now = Date.now()
  if (Object.values(presence).some((p) => now - p.at < SESSION_IDLE_MS)) return false
  const [session, chat] = await Promise.all([readSession(firebase, instanceId), readChat(firebase, chatPath(instanceId))])
  if (!session && chat.length === 0) return false
  if (!(await firebase.claim(`${root(instanceId)}/claims/end-${session?.startedAt ?? chat[0]?.at}`))) return false
  if (session?.logRef) await editLiveMessage(session.logRef, sessionBody(session, session.rounds ?? [], chat, "Bordet ble tomt - runden er over"))
  await firebase.updateData({ [sessionPath(instanceId)]: null, [chatPath(instanceId)]: null })
  return true
}

export async function postRouletteChat(instanceId: string, user: AuthenticatedDiscordUser, text: unknown) {
  const firebase = new FirebaseHelper()
  await touchPresence(firebase, instanceId, user)
  const result = await postChat(firebase, chatPath(instanceId), user, text)
  if ("error" in result) return err(result.error)
  return Response.json({ chat: result.chat })
}

// ---------- rules (bot parity) ----------

/** How many times the stake a bet returns on this number (0 = lost). Same rules as the bot's /rulett - including that 0
 * counts as "even" there (`roll % 2 == 0`), so it does here too. */
function payoutMultiplier(bet: Bet, roll: number): number {
  const { numberPayout, categoryPayout, red } = rouletteValues
  switch (bet.type) {
    case "number":
      return roll === bet.value ? numberPayout : 0
    case "red":
      return red.includes(roll) ? categoryPayout : 0
    case "black":
      return roll !== 0 && !red.includes(roll) ? categoryPayout : 0
    case "odd":
      return roll % 2 === 1 ? categoryPayout : 0
    case "even":
      return roll % 2 === 0 ? categoryPayout : 0
  }
}

const colorName = { green: "grønn", red: "rød", black: "svart" }

function colorOf(roll: number): "green" | "red" | "black" {
  if (roll === 0) return "green"
  return rouletteValues.red.includes(roll) ? "red" : "black"
}

// ---------- table state ----------

function normalizeTable(raw: any): Table {
  return { ...raw, history: raw.history ?? [] }
}

/** `raw` is what's at the table's path, for a caller that has read it already. */
async function readTable(firebase: FirebaseHelper, instanceId: string, raw?: any): Promise<Table> {
  raw ??= await firebase.getData(`${root(instanceId)}/table`)
  if (raw) return normalizeTable(raw)
  // First visit to this channel's table. Two people opening it at once both write essentially the same thing.
  const fresh: Table = { roundId: 1, phase: "betting", endsAt: Date.now() + rouletteValues.bettingMs, history: [] }
  await firebase.updateData({ [`${root(instanceId)}/table`]: fresh, ...bump(instanceId) })
  return fresh
}

/** bets/{roundId} -> userId -> key -> bet */
async function readBets(firebase: FirebaseHelper, instanceId: string, roundId: number): Promise<Record<string, Record<string, Bet>>> {
  return (await firebase.getData(`${root(instanceId)}/bets/${roundId}`)) ?? {}
}

type Presence = Record<string, { name: string; avatar: string | null; at: number }>

const presenceOf = (user: AuthenticatedDiscordUser) => ({ name: user.globalName ?? user.username, avatar: user.avatar ?? null, at: Date.now() })

/** `arriving`: they weren't in the player list before this, so it's a change to the table and not just a heartbeat. */
async function touchPresence(firebase: FirebaseHelper, instanceId: string, user: AuthenticatedDiscordUser, arriving = false) {
  await firebase.updateData({ [`${root(instanceId)}/presence/${user.id}`]: presenceOf(user), ...(arriving ? bump(instanceId) : {}) })
}

/** Everything one view of the table is made from. */
interface TableState {
  table: Table
  /** This round's bets: userId -> key -> bet */
  bets: Record<string, Record<string, Bet>>
  presence: Presence
  /** Who has pressed Spin this round. */
  ready: Record<string, true>
  chips: number
  chat: ChatMessage[]
  version: number
}

/** Reads the whole state in one go - small reads side by side instead of one after the other. Bets and the ready list are
 * stored per round, and only the current round's are kept around, so they're read whole and the round picked out afterwards.
 * The version is asked for first, so it's never newer than the rest: the worst a change landing in the middle can do is make
 * a client ask once more. */
async function loadState(firebase: FirebaseHelper, instanceId: string, userId: string): Promise<TableState> {
  const [version, tableRaw, bets, presence, ready, chips, chat] = await Promise.all([
    firebase.getData(`${root(instanceId)}/v`),
    firebase.getData(`${root(instanceId)}/table`),
    firebase.getData(`${root(instanceId)}/bets`),
    firebase.getData(`${root(instanceId)}/presence`),
    firebase.getData(`${root(instanceId)}/ready`),
    firebase.getChips(userId),
    readChatTail(firebase, chatPath(instanceId)),
  ])
  const table = await readTable(firebase, instanceId, tableRaw)
  return { table, bets: bets?.[table.roundId] ?? {}, presence: presence ?? {}, ready: ready?.[table.roundId] ?? {}, chips, chat, version: version ?? 0 }
}

/** Picks the winning number and settles every bet in one atomic write together with the move to the result phase.
 * Only ever called by the one process that won the claim for this round. */
async function resolveRound(firebase: FirebaseHelper, instanceId: string, table: Table, bets: Record<string, Record<string, Bet>>) {
  const roll = randomInt(0, 37)
  const color = colorOf(roll)
  const updates: Record<string, unknown> = {}
  const results: Record<string, PlayerResult> = {}

  for (const [userId, userBets] of Object.entries(bets)) {
    let staked = 0
    let returned = 0
    let won = 0
    let lost = 0
    const list = Object.values(userBets)
    for (const bet of list) {
      const back = bet.stake * payoutMultiplier(bet, roll)
      staked += bet.stake
      returned += back
      if (back > 0) won++
      else lost++
    }
    results[userId] = { name: list[0]?.name ?? "?", staked, returned, net: returned - staked }

    // Stakes were taken when the bets were placed, so only the winnings come back here.
    if (returned > 0) updates[`users/${userId}/chips`] = increment(returned)
    // Same stats the bot's /rulett keeps - once per bet, since each bet there was its own command.
    updates[`users/${userId}/userStats/rulettStats/${roll % 2 === 0 ? "even" : "odd"}`] = increment(list.length)
    updates[`users/${userId}/userStats/rulettStats/${color}`] = increment(list.length)
    if (won > 0) updates[`users/${userId}/userStats/chipsStats/roulettWins`] = increment(won)
    if (lost > 0) updates[`users/${userId}/userStats/chipsStats/rouletteLosses`] = increment(lost)
  }

  const next: Table = {
    roundId: table.roundId,
    phase: "result",
    endsAt: Date.now() + rouletteValues.resultMs,
    winningNumber: roll,
    history: [...table.history, roll].slice(-HISTORY_LENGTH),
    results,
  }
  updates[`${root(instanceId)}/table`] = next
  await firebase.updateData({ ...updates, ...bump(instanceId) })
  after(() => logRound(firebase, instanceId, table.roundId, roll, results))
}

/** Moves the table along if its time is up. Safe to call from every poll - see the notes at the top. `current` is the table for a
 * caller that has read it already; it's handed back untouched (the same object) when there was nothing to do. */
async function advance(firebase: FirebaseHelper, instanceId: string, current?: Table): Promise<Table> {
  let table = current ?? (await readTable(firebase, instanceId))
  const now = Date.now()

  if (table.phase === "betting" && now >= table.endsAt + rouletteValues.lateBetGraceMs) {
    const bets = await readBets(firebase, instanceId, table.roundId)
    if (Object.keys(bets).length === 0) {
      // Nobody bet: don't spin an empty wheel, just keep the round open for whoever shows up.
      table = { ...table, endsAt: now + rouletteValues.bettingMs }
      await firebase.updateData({ [`${root(instanceId)}/table/endsAt`]: table.endsAt, ...bump(instanceId) })
    } else {
      // A fresh claim key per minute past the deadline: if the process that won an earlier one died before finishing, the next
      // minute's poll can take over.
      const attempt = Math.floor((now - table.endsAt) / STALE_CLAIM_MS)
      if (await firebase.claim(`${root(instanceId)}/claims/${table.roundId}-spin-${attempt}`)) {
        await resolveRound(firebase, instanceId, table, bets)
      }
      table = await readTable(firebase, instanceId)
    }
  } else if (table.phase === "result" && now >= table.endsAt) {
    if (await firebase.claim(`${root(instanceId)}/claims/${table.roundId}-next`)) {
      await firebase.updateData({
        [`${root(instanceId)}/table`]: { roundId: table.roundId + 1, phase: "betting", endsAt: now + rouletteValues.bettingMs, history: table.history },
        [`${root(instanceId)}/bets/${table.roundId}`]: null,
        [`${root(instanceId)}/ready/${table.roundId}`]: null,
        // Old claims are only kept a few rounds - long enough that nothing can re-win one.
        [`${root(instanceId)}/claims/${table.roundId - 3}-spin-0`]: null,
        [`${root(instanceId)}/claims/${table.roundId - 3}-next`]: null,
        ...bump(instanceId),
      })
    }
    table = await readTable(firebase, instanceId)
  }
  return table
}

function tableView(state: TableState, userId: string) {
  const { table, bets, presence, chat } = state
  const readyIds = state.ready
  const now = Date.now()

  const summarize = (userBets: Record<string, Bet>) =>
    Object.entries(userBets).map(([key, b]) => ({ key, type: b.type, value: b.value, stake: b.stake }))

  const players = new Map<string, { id: string; username: string; avatar: string; bets: ReturnType<typeof summarize>; staked: number; ready: boolean }>()
  // Everyone with a bet this round, plus everyone who's currently at the table (polling) even without one.
  for (const [id, userBets] of Object.entries(bets)) {
    const list = summarize(userBets)
    const p = presence[id]
    players.set(id, {
      id,
      username: Object.values(userBets)[0]?.name ?? p?.name ?? "?",
      avatar: discordAvatarUrl(id, p?.avatar ?? null, 48),
      bets: list,
      staked: list.reduce((sum, b) => sum + b.stake, 0),
      ready: !!readyIds[id],
    })
  }
  for (const [id, p] of Object.entries(presence)) {
    if (players.has(id) || now - p.at > PRESENCE_VISIBLE_MS) continue
    players.set(id, { id, username: p.name, avatar: discordAvatarUrl(id, p.avatar ?? null, 48), bets: [], staked: 0, ready: false })
  }

  return {
    version: state.version,
    roundId: table.roundId,
    phase: table.phase,
    /** Time left in the current phase, measured on the server's clock so every client's countdown agrees. */
    msLeft: Math.max(0, table.endsAt - now),
    winningNumber: table.phase === "result" ? table.winningNumber : undefined,
    results: table.phase === "result" ? table.results : undefined,
    history: table.history,
    myChips: state.chips,
    chat,
    myBets: summarize(bets[userId] ?? {}),
    players: [...players.values()],
    /** The Spin button: how many of the players who have a bet have pressed it. Only those with a bet can, so only they count. */
    ready: {
      count: Object.keys(bets).filter((id) => readyIds[id]).length,
      total: Object.keys(bets).length,
      iAmReady: !!readyIds[userId],
    },
    config: {
      spinMs: rouletteValues.spinMs,
      spinDelayMs: rouletteValues.spinDelayMs,
      holdMs: rouletteValues.holdMs,
      resultMs: rouletteValues.resultMs,
      bettingMs: rouletteValues.bettingMs,
      lateBetGraceMs: rouletteValues.lateBetGraceMs,
      minBet: rouletteValues.minBet,
    },
  }
}

/** The view after an action: read fresh, since the action has just changed it. */
async function publicView(firebase: FirebaseHelper, instanceId: string, userId: string) {
  return tableView(await loadState(firebase, instanceId, userId), userId)
}

// ---------- actions ----------

export async function getRouletteTable(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  let state = await loadState(firebase, instanceId, user.id)

  // This poll is the heartbeat. The stamp is only rewritten once it's getting old, and after the answer has gone out - the
  // caller is put in the presence list used for this answer either way.
  const mine = state.presence[user.id]
  const age = mine ? Date.now() - mine.at : Infinity
  if (age >= SESSION_IDLE_MS && (await endIdleSession(firebase, instanceId, state.presence))) state.chat = []
  if (age > PRESENCE_TOUCH_MS) after(() => touchPresence(firebase, instanceId, user, age > PRESENCE_VISIBLE_MS))

  const table = await advance(firebase, instanceId, state.table)
  if (table !== state.table) state = await loadState(firebase, instanceId, user.id)
  state.presence[user.id] = presenceOf(user)
  return Response.json(tableView(state, user.id))
}

export async function placeRouletteBet(instanceId: string, user: AuthenticatedDiscordUser, input: { type?: unknown; value?: unknown; stake?: unknown }) {
  const firebase = new FirebaseHelper()
  const type = BET_TYPES.find((t) => t === input.type)
  if (!type) return err("Ugyldig innsats")
  let value: number | undefined
  if (type === "number") {
    value = Number(input.value)
    if (!Number.isInteger(value) || value < 0 || value > 36) return err("Tallet må være mellom 0 og 36")
  }
  const stake = Math.floor(Number(input.stake))
  if (!(stake >= rouletteValues.minBet)) return err(`Minste innsats er ${rouletteValues.minBet}`)

  const [table, chips] = await Promise.all([advance(firebase, instanceId), firebase.getChips(user.id), touchPresence(firebase, instanceId, user)])
  if (table.phase !== "betting" || Date.now() >= table.endsAt) return err("Innsatsene er stengt for denne runden")
  if (chips < stake) return err(`Du har ikke nok chips (du har ${chips})`)

  await ensureSession(firebase, instanceId, user)
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const bet: Bet = { type, stake, name: user.globalName ?? user.username, ...(value !== undefined ? { value } : {}) }
  // Taking the stake and recording the bet are one write - a bet can never be paid for and then lost, or recorded but free.
  await firebase.updateData({
    [`users/${user.id}/chips`]: increment(-stake),
    [`${root(instanceId)}/bets/${table.roundId}/${user.id}/${key}`]: bet,
    ...bump(instanceId),
  })

  // Two of this player's requests can both pass the balance check above before either lands. If that overdrew them,
  // undo this bet instead of leaving them in the red.
  if ((await firebase.getChips(user.id)) < 0) {
    await firebase.updateData({
      [`users/${user.id}/chips`]: increment(stake),
      [`${root(instanceId)}/bets/${table.roundId}/${user.id}/${key}`]: null,
      ...bump(instanceId),
    })
    return err("Du har ikke nok chips")
  }
  return Response.json(await publicView(firebase, instanceId, user.id))
}

/** Takes back all of your bets for the round that's still open, refunding the stakes. */
export async function clearRouletteBets(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const [table] = await Promise.all([advance(firebase, instanceId), touchPresence(firebase, instanceId, user)])
  if (table.phase !== "betting" || Date.now() >= table.endsAt) return err("Innsatsene er stengt for denne runden")

  const mine = ((await firebase.getData(`${root(instanceId)}/bets/${table.roundId}/${user.id}`)) ?? {}) as Record<string, Bet>
  const refund = Object.values(mine).reduce((sum, b) => sum + b.stake, 0)
  if (refund > 0) {
    await firebase.updateData({
      [`users/${user.id}/chips`]: increment(refund),
      [`${root(instanceId)}/bets/${table.roundId}/${user.id}`]: null,
      [`${root(instanceId)}/ready/${table.roundId}/${user.id}`]: null,
      ...bump(instanceId),
    })
  }
  return Response.json(await publicView(firebase, instanceId, user.id))
}

/** "Spin": you're done betting. Needs at least one bet of your own. Once every player who has a bet has pressed it there's nothing
 * left to wait for, so the round's clock is pulled forward instead of run out. It goes through the normal end-of-betting path
 * (bets closed, short pause for requests still in flight, then the spin) - just with the deadline moved - so a forced spin gets
 * exactly the same exactly-once handling as one that ran out of time. */
export async function readyRouletteSpin(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const [table] = await Promise.all([advance(firebase, instanceId), touchPresence(firebase, instanceId, user)])
  if (table.phase !== "betting" || Date.now() >= table.endsAt) return err("Innsatsene er stengt for denne runden")

  const mine = (await firebase.getData(`${root(instanceId)}/bets/${table.roundId}/${user.id}`)) ?? {}
  if (Object.keys(mine).length === 0) return err("Legg en innsats før du spinner")

  await firebase.updateData({ [`${root(instanceId)}/ready/${table.roundId}/${user.id}`]: true, ...bump(instanceId) })

  const [bets, ready] = await Promise.all([
    readBets(firebase, instanceId, table.roundId),
    firebase.getData(`${root(instanceId)}/ready/${table.roundId}`) as Promise<Record<string, true> | undefined>,
  ])
  if (Object.keys(bets).every((id) => ready?.[id])) {
    // Back-dated by the grace period so bets are refused from this instant, while the spin itself is only forcedSpinDelayMs away.
    const forcedEnd = Date.now() - rouletteValues.lateBetGraceMs + rouletteValues.forcedSpinDelayMs
    if (table.endsAt > forcedEnd) await firebase.updateData({ [`${root(instanceId)}/table/endsAt`]: forcedEnd, ...bump(instanceId) })
  }
  return Response.json(await publicView(firebase, instanceId, user.id))
}
