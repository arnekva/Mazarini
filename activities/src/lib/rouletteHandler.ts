import { randomInt } from "node:crypto"
import { increment } from "firebase/database"
import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { discordAvatarUrl } from "./discordAvatar"
import { rouletteValues } from "./gameValues"

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
/** A spin claim older than this that still hasn't produced a result is presumed dead (crashed request) and can be retried. */
const STALE_CLAIM_MS = 60 * 1000

const root = (instanceId: string) => `other/multiplayerRoulette/${instanceId}`
const err = (message: string, status = 400) => Response.json({ error: message }, { status })

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

function colorOf(roll: number): "green" | "red" | "black" {
  if (roll === 0) return "green"
  return rouletteValues.red.includes(roll) ? "red" : "black"
}

// ---------- table state ----------

function normalizeTable(raw: any): Table {
  return { ...raw, history: raw.history ?? [] }
}

async function readTable(firebase: FirebaseHelper, instanceId: string): Promise<Table> {
  const raw = await firebase.getData(`${root(instanceId)}/table`)
  if (raw) return normalizeTable(raw)
  // First visit to this channel's table. Two people opening it at once both write essentially the same thing.
  const fresh: Table = { roundId: 1, phase: "betting", endsAt: Date.now() + rouletteValues.bettingMs, history: [] }
  await firebase.updateData({ [`${root(instanceId)}/table`]: fresh })
  return fresh
}

/** bets/{roundId} -> userId -> key -> bet */
async function readBets(firebase: FirebaseHelper, instanceId: string, roundId: number): Promise<Record<string, Record<string, Bet>>> {
  return (await firebase.getData(`${root(instanceId)}/bets/${roundId}`)) ?? {}
}

async function touchPresence(firebase: FirebaseHelper, instanceId: string, user: AuthenticatedDiscordUser) {
  await firebase.updateData({
    [`${root(instanceId)}/presence/${user.id}`]: { name: user.globalName ?? user.username, avatar: user.avatar ?? null, at: Date.now() },
  })
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
  await firebase.updateData(updates)
}

/** Moves the table along if its time is up. Safe to call from every poll - see the notes at the top. */
async function advance(firebase: FirebaseHelper, instanceId: string): Promise<Table> {
  let table = await readTable(firebase, instanceId)
  const now = Date.now()

  if (table.phase === "betting" && now >= table.endsAt + rouletteValues.lateBetGraceMs) {
    const bets = await readBets(firebase, instanceId, table.roundId)
    if (Object.keys(bets).length === 0) {
      // Nobody bet: don't spin an empty wheel, just keep the round open for whoever shows up.
      table = { ...table, endsAt: now + rouletteValues.bettingMs }
      await firebase.updateData({ [`${root(instanceId)}/table/endsAt`]: table.endsAt })
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
      })
    }
    table = await readTable(firebase, instanceId)
  }
  return table
}

async function publicView(firebase: FirebaseHelper, instanceId: string, table: Table, userId: string) {
  type Presence = Record<string, { name: string; avatar: string | null; at: number }>
  const [bets, presence, dbUser, readyRaw]: [Record<string, Record<string, Bet>>, Presence | undefined, any, Record<string, true> | undefined] = await Promise.all([
    readBets(firebase, instanceId, table.roundId),
    firebase.getData(`${root(instanceId)}/presence`),
    firebase.getUser(userId),
    firebase.getData(`${root(instanceId)}/ready/${table.roundId}`),
  ])
  const readyIds = readyRaw ?? {}
  const now = Date.now()

  const summarize = (userBets: Record<string, Bet>) =>
    Object.entries(userBets).map(([key, b]) => ({ key, type: b.type, value: b.value, stake: b.stake }))

  const players = new Map<string, { id: string; username: string; avatar: string; bets: ReturnType<typeof summarize>; staked: number; ready: boolean }>()
  // Everyone with a bet this round, plus everyone who's currently at the table (polling) even without one.
  for (const [id, userBets] of Object.entries(bets)) {
    const list = summarize(userBets)
    const p = presence?.[id]
    players.set(id, {
      id,
      username: Object.values(userBets)[0]?.name ?? p?.name ?? "?",
      avatar: discordAvatarUrl(id, p?.avatar ?? null, 48),
      bets: list,
      staked: list.reduce((sum, b) => sum + b.stake, 0),
      ready: !!readyIds[id],
    })
  }
  for (const [id, p] of Object.entries(presence ?? {})) {
    if (players.has(id) || now - p.at > PRESENCE_VISIBLE_MS) continue
    players.set(id, { id, username: p.name, avatar: discordAvatarUrl(id, p.avatar ?? null, 48), bets: [], staked: 0, ready: false })
  }

  return {
    roundId: table.roundId,
    phase: table.phase,
    /** Time left in the current phase, measured on the server's clock so every client's countdown agrees. */
    msLeft: Math.max(0, table.endsAt - now),
    winningNumber: table.phase === "result" ? table.winningNumber : undefined,
    results: table.phase === "result" ? table.results : undefined,
    history: table.history,
    myChips: dbUser?.chips ?? 0,
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
      minBet: rouletteValues.minBet,
    },
  }
}

// ---------- actions ----------

export async function getRouletteTable(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  await touchPresence(firebase, instanceId, user)
  const table = await advance(firebase, instanceId)
  return Response.json(await publicView(firebase, instanceId, table, user.id))
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

  await touchPresence(firebase, instanceId, user)
  const table = await advance(firebase, instanceId)
  if (table.phase !== "betting" || Date.now() >= table.endsAt) return err("Innsatsene er stengt for denne runden")

  const dbUser = (await firebase.getUser(user.id)) ?? {}
  if ((dbUser.chips ?? 0) < stake) return err(`Du har ikke nok chips (du har ${dbUser.chips ?? 0})`)

  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const bet: Bet = { type, stake, name: user.globalName ?? user.username, ...(value !== undefined ? { value } : {}) }
  // Taking the stake and recording the bet are one write - a bet can never be paid for and then lost, or recorded but free.
  await firebase.updateData({
    [`users/${user.id}/chips`]: increment(-stake),
    [`${root(instanceId)}/bets/${table.roundId}/${user.id}/${key}`]: bet,
  })

  // Two of this player's requests can both pass the balance check above before either lands. If that overdrew them,
  // undo this bet instead of leaving them in the red.
  const after = (await firebase.getUser(user.id)) ?? {}
  if ((after.chips ?? 0) < 0) {
    await firebase.updateData({
      [`users/${user.id}/chips`]: increment(stake),
      [`${root(instanceId)}/bets/${table.roundId}/${user.id}/${key}`]: null,
    })
    return err("Du har ikke nok chips")
  }
  return Response.json(await publicView(firebase, instanceId, table, user.id))
}

/** Takes back all of your bets for the round that's still open, refunding the stakes. */
export async function clearRouletteBets(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  await touchPresence(firebase, instanceId, user)
  const table = await advance(firebase, instanceId)
  if (table.phase !== "betting" || Date.now() >= table.endsAt) return err("Innsatsene er stengt for denne runden")

  const mine = ((await firebase.getData(`${root(instanceId)}/bets/${table.roundId}/${user.id}`)) ?? {}) as Record<string, Bet>
  const refund = Object.values(mine).reduce((sum, b) => sum + b.stake, 0)
  if (refund > 0) {
    await firebase.updateData({
      [`users/${user.id}/chips`]: increment(refund),
      [`${root(instanceId)}/bets/${table.roundId}/${user.id}`]: null,
      [`${root(instanceId)}/ready/${table.roundId}/${user.id}`]: null,
    })
  }
  return Response.json(await publicView(firebase, instanceId, table, user.id))
}

/** "Spin": you're done betting. Needs at least one bet of your own. Once every player who has a bet has pressed it there's nothing
 * left to wait for, so the round's clock is pulled forward instead of run out. It goes through the normal end-of-betting path
 * (bets closed, short pause for requests still in flight, then the spin) - just with the deadline moved - so a forced spin gets
 * exactly the same exactly-once handling as one that ran out of time. */
export async function readyRouletteSpin(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  await touchPresence(firebase, instanceId, user)
  let table = await advance(firebase, instanceId)
  if (table.phase !== "betting" || Date.now() >= table.endsAt) return err("Innsatsene er stengt for denne runden")

  const mine = (await firebase.getData(`${root(instanceId)}/bets/${table.roundId}/${user.id}`)) ?? {}
  if (Object.keys(mine).length === 0) return err("Legg en innsats før du spinner")

  await firebase.updateData({ [`${root(instanceId)}/ready/${table.roundId}/${user.id}`]: true })

  const [bets, ready] = await Promise.all([
    readBets(firebase, instanceId, table.roundId),
    firebase.getData(`${root(instanceId)}/ready/${table.roundId}`) as Promise<Record<string, true> | undefined>,
  ])
  if (Object.keys(bets).every((id) => ready?.[id])) {
    // Back-dated by the grace period so bets are refused from this instant, while the spin itself is only forcedSpinDelayMs away.
    const forcedEnd = Date.now() - rouletteValues.lateBetGraceMs + rouletteValues.forcedSpinDelayMs
    if (table.endsAt > forcedEnd) {
      await firebase.updateData({ [`${root(instanceId)}/table/endsAt`]: forcedEnd })
      table = { ...table, endsAt: forcedEnd }
    }
  }
  return Response.json(await publicView(firebase, instanceId, table, user.id))
}
