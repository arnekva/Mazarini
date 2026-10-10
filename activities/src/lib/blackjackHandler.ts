import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { Card, drawCard, freshShuffledDeck, handValue, isBlackjack } from "./blackjack"
import { discordAvatarUrl } from "./discordAvatar"
import { editLiveMessage, liveLogBody, LiveMessageRef, postLiveMessage, resolveAnnounceChannel } from "./discordMessage"
import { increment } from "firebase/database"
import { after } from "next/server"
import { chatEmbedFields, postChat, readChat, readChatTail } from "./gameChat"
import { blackjackValues } from "./gameValues"

type HandStatus = "playing" | "stood" | "bust" | "blackjack"
type TableStatus = "waiting" | "playing" | "roundOver"
type Result = "win" | "lose" | "push" | "blackjack"

interface PlayerHand {
  cards: Card[]
  status: HandStatus
  /** Doubled down: a second buy-in went on this hand, it got exactly one more card, and it stakes (and pays) twice the buy-in. */
  doubled?: boolean
}

interface Spectator {
  username: string
  avatar: string | null
}

interface BlackjackPlayer {
  id: string
  username: string
  /** Avatar hash, or null for the default avatar - see discordAvatarUrl in ./discordAvatar. */
  avatar: string | null
  sittingOut: boolean
  /** Normally one hand - more than one once you've split. Acted on left-to-right: the first hand
   * still `playing` is the one Hit/Stand/Split apply to. */
  hands: PlayerHand[]
  /** Chip balance the moment they sat down - the baseline a "left the table with +/-X chips"
   * announcement diffs their current balance against. */
  startingChips: number
  /** Whether they've actually been dealt at least one round - a leave announcement is only useful
   * (and only accurate re: chip delta) for someone who's actually played, not someone who just sat
   * down and immediately left again. */
  hasPlayed: boolean
  /** > 0 if this player's table buy-in was funded by real deathroll pot winnings (never a manually-
   * typed stake) - "tilbakelegg" refunds half of *this* amount (not the current stake, which can
   * change round to round) to the deathroll pot on every hand they lose while seated here. 0 means
   * no refund applies. */
  deathrollPotStake: number
  /** Set only on a seat funded by a deathroll pot win: what's left of that pot money at this table. Every ante and payout moves it
   * along with the chips (see applyToPotBankrolls), and the seat can never bet more than this - the pot win is played on its own,
   * never with the chips the player had before. Undefined is an ordinary seat playing with all their chips. */
  potBankroll?: number
}

interface RedealVote {
  requestedBy: string
  votes: Record<string, true>
  createdAt: number
}

/** A vote to raise the table's buy-in - mirrors RedealVote's unanimous-yes shape. Only needed once
 * there's more than one player; a solo host can just change it directly (see adjustBlackjackBet). */
interface BetVote {
  proposedBuyIn: number
  requestedBy: string
  votes: Record<string, true>
  createdAt: number
}

interface BlackjackLobby {
  id: string
  hostId: string
  buyIn: number
  status: TableStatus
  players: Record<string, BlackjackPlayer>
  playerOrder: string[]
  /** Watchers - no seat, no ante, no hand, just the same live table view everyone else gets. */
  spectators: Record<string, Spectator>
  dealerHand: Card[]
  dealerHidden: boolean
  deck: Card[]
  /** One result per hand, in the same order as that player's `hands`. */
  results?: Record<string, Result[]>
  /** "Tilbakelegg" - chips refunded to the deathroll pot this round, per player id whose loss triggered it. */
  potRefunds?: Record<string, number>
  /** An in-progress "Deal på ny" vote - needs a yes from every active (non-sitting-out) player. */
  redealVote?: RedealVote
  /** Player ids whose redeal request already got voted down this round - blocked from asking again
   * until the round resolves (performDeal/performRedeal both clear this). */
  redealDeniedFor?: string[]
  /** An in-progress vote to raise the table's buy-in. */
  betVote?: BetVote
  /** Set when a round resolves to "roundOver" - dealBlackjackRound enforces a short cooldown from
   * this timestamp before a new round can be dealt, so every client has time to actually see the
   * previous round's result (and stop rendering now-stale Hit/Stand buttons) before acting again. */
  roundOverAt?: number
  /** Where this table's announcements go: the channel its host launched the Activity from (already resolved - see resolveAnnounceChannel). */
  channelId?: string
  /** Bumped on every action; the action's resulting view is also stored as a frame (see writeFrame) so spectators can replay what they missed between polls. */
  frameSeq?: number
  /** Players who earned a "Deal på ny" from the round that just resolved (a deathroll-pot stake that won) - only meaningful while status is "roundOver". */
  redealBonusIds?: string[]
  /** The Discord message that is edited as the table plays (see syncLog), and what it says: how many rounds have been played and where
   * everyone who's played stands in total - kept per person (not per round) so the message stays the same size however long the table runs.
   * Someone who has left keeps their line. */
  logRef?: LiveMessageRef
  roundsPlayed?: number
  totals?: Record<string, { name: string; net: number }>
  createdAt: number
  updatedAt: number
}

/** Minimum time between a round resolving and the next one being dealable - gives every polling
 * client (TABLE_POLL_MS = 1000ms) at least one refresh to catch the "roundOver" state and stop
 * showing stale in-round action buttons, instead of a fast player's next deal racing a slow
 * client's still-rendered Hit/Stand into acting on the wrong round. */
const ROUND_START_COOLDOWN_MS = 3000

// A win pays out the ante back plus even money (2x); blackjack pays 3:2 on top of the ante back
// (2.5x); a push just returns the ante (1x); a loss returns nothing (already deducted at deal/split time).
const PAYOUT_MULTIPLIER: Record<Result, number> = { win: 2, blackjack: 2.5, push: 1, lose: 0 }

// One voice channel (instanceId) can host several concurrent lobbies - other/multiplayerBlackjack/{instanceId}/{lobbyId}.
const PATH_PREFIX = "multiplayerBlackjack"

/** Firebase RTDB drops empty-array fields on write (no children = indistinguishable from "not
 * there"), so a lobby that's never had a round dealt can come back with `dealerHand`/`deck`
 * missing entirely, and a just-joined player with `hands` missing - normalize those back to `[]`.
 * Also: never spread a key whose value is `undefined` (e.g. `results`) back into a write - Firebase
 * rejects that outright, which is why this reads back only real values for optional fields. */
function normalizeLobby(raw: any): BlackjackLobby {
  const players: Record<string, BlackjackPlayer> = {}
  for (const id of Object.keys(raw.players ?? {})) {
    const p = raw.players[id]
    players[id] = {
      id: p.id,
      username: p.username,
      avatar: p.avatar ?? null,
      sittingOut: p.sittingOut ?? false,
      hands: (p.hands ?? []).map((h: any) => ({ cards: h.cards ?? [], status: h.status, ...(h.doubled ? { doubled: true } : {}) })),
      startingChips: p.startingChips ?? 0,
      hasPlayed: p.hasPlayed ?? false,
      deathrollPotStake: p.deathrollPotStake ?? 0,
      ...(typeof p.potBankroll === "number" ? { potBankroll: p.potBankroll } : {}),
    }
  }
  const spectators: Record<string, Spectator> = {}
  for (const id of Object.keys(raw.spectators ?? {})) {
    const s = raw.spectators[id]
    // Older entries (before spectator avatars) were stored as a plain username string.
    spectators[id] = typeof s === "string" ? { username: s, avatar: null } : { username: s.username, avatar: s.avatar ?? null }
  }
  return {
    id: raw.id,
    hostId: raw.hostId,
    buyIn: raw.buyIn ?? 0,
    status: raw.status ?? "waiting",
    players,
    playerOrder: raw.playerOrder ?? [],
    spectators,
    dealerHand: raw.dealerHand ?? [],
    dealerHidden: raw.dealerHidden ?? false,
    deck: raw.deck ?? [],
    ...(raw.results ? { results: raw.results } : {}),
    ...(raw.potRefunds ? { potRefunds: raw.potRefunds } : {}),
    ...(raw.redealVote ? { redealVote: raw.redealVote } : {}),
    ...(raw.redealDeniedFor ? { redealDeniedFor: raw.redealDeniedFor } : {}),
    ...(raw.betVote ? { betVote: raw.betVote } : {}),
    ...(raw.roundOverAt ? { roundOverAt: raw.roundOverAt } : {}),
    ...(raw.channelId ? { channelId: raw.channelId } : {}),
    ...(raw.frameSeq ? { frameSeq: raw.frameSeq } : {}),
    ...(raw.redealBonusIds ? { redealBonusIds: raw.redealBonusIds } : {}),
    ...(raw.logRef ? { logRef: raw.logRef } : {}),
    // `rounds` is what a table opened before the totals existed kept instead: one text per round.
    ...(raw.roundsPlayed || raw.rounds ? { roundsPlayed: raw.roundsPlayed ?? Object.values(raw.rounds).length } : {}),
    ...(raw.totals ? { totals: raw.totals } : {}),
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? Date.now(),
  }
}

const lobbyPath = (instanceId: string, lobbyId: string) => `other/${PATH_PREFIX}/${instanceId}/${lobbyId}`

/** A lobby as it's stored, stamped with the time of this write - which doubles as its version: every view carries it, and clients
 * compare it with the one in the database to know whether they're behind (see lib/liveSignal.ts). The JSON round-trip strips
 * `undefined` fields, which Firebase rejects outright. */
function forDb(lobby: BlackjackLobby) {
  lobby.updatedAt = Date.now()
  return JSON.parse(JSON.stringify(lobby))
}

async function readLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string): Promise<BlackjackLobby | null> {
  const data = await firebase.getData(lobbyPath(instanceId, lobbyId))
  return data ? normalizeLobby({ id: lobbyId, ...data }) : null
}

async function readAllLobbies(firebase: FirebaseHelper, instanceId: string): Promise<Record<string, BlackjackLobby>> {
  const data = (await firebase.getData(`other/${PATH_PREFIX}/${instanceId}`)) ?? {}
  const result: Record<string, BlackjackLobby> = {}
  for (const lobbyId of Object.keys(data)) result[lobbyId] = normalizeLobby({ id: lobbyId, ...data[lobbyId] })
  return result
}

/** Every change to an existing lobby goes through here: an atomic read-modify-write (see FirebaseHelper.transact), so two requests
 * landing together - two players acting at once, a disconnect sweep in the middle of someone's hit - can't overwrite each other.
 * `apply` returns the changed lobby, or undefined to leave it alone. It can run more than once, so side effects (chips, Discord)
 * belong after this resolves. Resolves to the lobby as it is afterwards - null if it's gone. */
async function updateLobby(
  firebase: FirebaseHelper,
  instanceId: string,
  lobbyId: string,
  apply: (lobby: BlackjackLobby) => BlackjackLobby | undefined
): Promise<BlackjackLobby | null> {
  const raw = await firebase.transact<any>(lobbyPath(instanceId, lobbyId), (current) => {
    const next = apply(normalizeLobby({ id: lobbyId, ...current }))
    return next && forDb(next)
  })
  return raw ? normalizeLobby({ id: lobbyId, ...raw }) : null
}

// ---------- presence: noticing that someone's gone ----------
//
// There's no long-lived connection to hook an "on disconnect" into - every action is a stateless serverless request,
// so a player who closes the Activity (or loses signal) simply stops asking. What we *can* see is that they've stopped:
// a table poll refreshes the caller's stamp under other/multiplayerBlackjackPresence once it's a few seconds old, and whoever
// polls next removes anyone whose stamp has gone stale - through the same leaveLobby a manual leave uses, so the
// table, the round and the Discord announcement all behave the same. Kept apart from the lobby record so a heartbeat
// can never race a game action's read-modify-write.
const PRESENCE_PREFIX = "multiplayerBlackjackPresence"
/** Long enough to ride out switching to another app on a phone for a moment, short enough that a dead seat doesn't hold a table hostage. */
const DISCONNECT_AFTER_MS = 60 * 1000
/** A stamp younger than this isn't rewritten - polls come every second, the stamp only has to stay well inside DISCONNECT_AFTER_MS. */
const PRESENCE_TOUCH_MS = 15 * 1000

type Presence = Record<string, number>

const presencePath = (instanceId: string, lobbyId: string) => `other/${PRESENCE_PREFIX}/${instanceId}/${lobbyId}`

async function touchPresence(firebase: FirebaseHelper, instanceId: string, lobbyId: string, userId: string) {
  await firebase.updateData({ [`${presencePath(instanceId, lobbyId)}/${userId}`]: Date.now() })
}

async function deleteLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string) {
  await firebase.updateData({
    [lobbyPath(instanceId, lobbyId)]: null,
    [presencePath(instanceId, lobbyId)]: null,
    [framesPath(instanceId, lobbyId)]: null,
    [`other/multiplayerBlackjackChat/${instanceId}/${lobbyId}`]: null,
  })
}

// ---------- frames: what spectators would otherwise miss between two polls ----------
//
// A player acts and gets an immediate answer, but a spectator only sees whatever state the table is in at the moment their poll
// lands - a host who hits, stands and redeals within a second or two never shows up at all. So every action also leaves a frame
// (the resulting shared table view) in a small ring of slots, and a spectator's poll asks for everything newer than the last
// frame it saw and replays those in order.
const FRAME_SLOTS = 12
const framesPath = (instanceId: string, lobbyId: string) => `other/multiplayerBlackjackFrames/${instanceId}/${lobbyId}`

/** The frames newer than `since` out of everything stored under framesPath, oldest first. */
function framesSince(raw: unknown, since: number) {
  return (Object.values(raw ?? {}) as { seq: number; view: unknown }[]).filter((f) => f && f.seq > since).sort((a, b) => a.seq - b.seq)
}

/** What this player can put on the table: all their chips, or for a pot-funded seat only what's left of the pot money. */
function spendable(player: BlackjackPlayer | undefined, chips: number): number {
  return player?.potBankroll === undefined ? chips : Math.min(chips, player.potBankroll)
}

/** Moves each pot-funded seat's bankroll by the same amount as its chips - called inside the transaction, so the two never drift apart. */
function applyToPotBankrolls(lobby: BlackjackLobby, chipDeltas: Record<string, number> | undefined) {
  for (const [id, delta] of Object.entries(chipDeltas ?? {})) {
    const player = lobby.players[id]
    if (player?.potBankroll !== undefined) player.potBankroll = Math.max(0, player.potBankroll + delta)
  }
}

/** A player who staked real deathroll-pot money and won a hand this round earns a "Deal på ny". */
function redealBonusRecipients(lobby: BlackjackLobby): string[] {
  return lobby.playerOrder.filter((id) => lobby.players[id].deathrollPotStake > 0 && lobby.results?.[id]?.some((r) => r === "win" || r === "blackjack"))
}

/** What a lobby-mutating `compute` callback hands back to runLobbyMutation: the new lobby state to
 * write, plus any side effects (chip changes, a deathroll-pot refund) - kept separate from `lobby`
 * so they can be applied in one clear place after the write, rather than scattered through each
 * action's own logic. */
interface LobbyMutationOutcome {
  lobby: BlackjackLobby
  /** userId -> chip delta (can be negative, e.g. an ante) to apply after the write. */
  chipDeltas?: Record<string, number>
  potRefundTotal?: number
  /** Players to grant one "Deal på ny" - filled in by settleRound, never by an action's own compute. */
  redealBonusIds?: string[]
}

type LobbyMutationResult = LobbyMutationOutcome | { error: string; status?: number }

/** Called on whatever a mutation produced: if it just resolved a round, works out who earned a "Deal på ny" (kept on the lobby so the table can say so)
 * and returns them; if a round is no longer over, clears the note. `roundOverAtBefore` tells "resolved just now" apart from "was already over". */
function settleRound(lobby: BlackjackLobby, roundOverAtBefore: number | undefined): string[] {
  if (lobby.status !== "roundOver") {
    delete lobby.redealBonusIds
    return []
  }
  if (lobby.roundOverAt === roundOverAtBefore) return []
  const ids = redealBonusRecipients(lobby)
  if (ids.length > 0) lobby.redealBonusIds = ids
  else delete lobby.redealBonusIds
  addRoundToTotals(lobby)
  return ids
}

// ---------- the Discord log message ----------
//
// The table posts one message when it's created and edits it as rounds finish (and once more, with the chat, when the table closes) -
// see the notes on live messages in discordMessage.ts. Nothing here depends on anyone still being connected.

const chatPath = (instanceId: string, lobbyId: string) => `other/multiplayerBlackjackChat/${instanceId}/${lobbyId}`

const fmtChips = (n: number) => n.toLocaleString("nb-NO")

/** What a hand has riding on it: the buy-in, twice over if it was doubled. */
const handStake = (lobby: BlackjackLobby, hand: PlayerHand | undefined) => lobby.buyIn * (hand?.doubled ? 2 : 1)

/** Counts the round that just resolved: each seated player's stake (one ante per hand, two on a doubled one) against what came back. */
function addRoundToTotals(lobby: BlackjackLobby) {
  const totals = { ...(lobby.totals ?? {}) }
  for (const id of lobby.playerOrder) {
    const player = lobby.players[id]
    const results = lobby.results?.[id]
    if (player.sittingOut || !results) continue
    const staked = results.reduce((sum, _r, i) => sum + handStake(lobby, player.hands[i]), 0)
    const returned = results.reduce((sum, r, i) => sum + Math.floor(handStake(lobby, player.hands[i]) * PAYOUT_MULTIPLIER[r]), 0)
    totals[id] = { name: player.username, net: (totals[id]?.net ?? 0) + returned - staked }
  }
  lobby.totals = totals
  lobby.roundsPlayed = (lobby.roundsPlayed ?? 0) + 1
}

/** The table so far, as the body of its Discord message: the number of rounds and one line per player, best first. */
function recap(lobby: BlackjackLobby): string[] {
  const rounds = lobby.roundsPlayed ?? 0
  if (rounds === 0) return []
  const lines = Object.values(lobby.totals ?? {})
    .sort((a, b) => b.net - a.net)
    .map((t) => `${t.name}: **${t.net > 0 ? "+" : t.net < 0 ? "−" : "±"}${fmtChips(Math.abs(t.net))}**`)
  return [[`**${rounds} ${rounds === 1 ? "runde" : "runder"} spilt**`, ...lines].join("\n")]
}

function logIntro(lobby: BlackjackLobby) {
  const host = lobby.players[lobby.hostId]?.username ?? "Noen"
  return `**${host}** startet en runde blackjack - buy-in ${fmtChips(lobby.buyIn)}`
}

/** Edits the table's Discord message to reflect the rounds played so far (and the chat). Best-effort. */
async function syncLog(firebase: FirebaseHelper, instanceId: string, lobby: BlackjackLobby, footer?: string) {
  if (!lobby.logRef) return
  try {
    const chat = await readChat(firebase, chatPath(instanceId, lobby.id))
    await editLiveMessage(lobby.logRef, liveLogBody("Blackjack", logIntro(lobby), recap(lobby), chatEmbedFields(chat, lobby.hostId), footer))
  } catch (e) {
    console.error("Blackjack log update failed", e)
  }
}

/** Last edit of a table's message, when the table is closing - awaited (unlike the per-round ones), since the lobby and its chat are deleted right after. */
async function closeLog(firebase: FirebaseHelper, instanceId: string, lobby: BlackjackLobby, note: string, reason: "left" | "disconnected") {
  await syncLog(firebase, instanceId, lobby, reason === "disconnected" ? `${note} (mistet tilkoblingen)` : note)
}

export async function postBlackjackChat(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser, text: unknown) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  if (!lobby.players[user.id] && lobby.spectators[user.id] === undefined) return Response.json({ error: "Du er ikke ved dette bordet" }, { status: 400 })
  const result = await postChat(firebase, chatPath(instanceId, lobbyId), user, text)
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 })
  return Response.json({ chat: result.chat })
}


/** Runs a game action on a lobby atomically (see updateLobby) and answers with the caller's view of the result. `compute` must be
 * synchronous and free of side effects - it runs again if the lobby changed underneath it - so anything it needs from the database
 * is read before calling this, and what it decides (chips, pot refund) is applied here, once, after the change is in. */
async function runLobbyMutation(
  firebase: FirebaseHelper,
  instanceId: string,
  lobbyId: string,
  userId: string,
  compute: (lobby: BlackjackLobby) => LobbyMutationResult
): Promise<Response> {
  // Left behind by whichever run of `compute` was the last one. (A box, because TS narrows a plain `let` assigned inside the callback to its initial value.)
  const box: { failure?: { error: string; status?: number }; outcome?: LobbyMutationOutcome; roundsBefore: number } = { roundsBefore: 0 }
  const lobby = await updateLobby(firebase, instanceId, lobbyId, (current) => {
    box.failure = undefined
    box.outcome = undefined
    box.roundsBefore = current.roundsPlayed ?? 0
    const roundOverAtBefore = current.roundOverAt
    const seq = (current.frameSeq ?? 0) + 1
    const result = compute(current)
    if ("error" in result) {
      box.failure = result
      return undefined
    }
    applyToPotBankrolls(result.lobby, result.chipDeltas)
    result.redealBonusIds = settleRound(result.lobby, roundOverAtBefore)
    result.lobby.frameSeq = seq
    box.outcome = result
    return result.lobby
  })
  if (box.failure) return Response.json({ error: box.failure.error }, { status: box.failure.status ?? 400 })
  if (!lobby || !box.outcome) return Response.json({ closed: true }, { status: 404 })

  const seq = lobby.frameSeq ?? 0
  // The JSON round-trip strips `undefined` fields, which Firebase rejects outright.
  const frame = JSON.parse(JSON.stringify({ seq, view: tableView(lobby, "", {}) }))
  await firebase.updateData({ [`${framesPath(instanceId, lobbyId)}/${seq % FRAME_SLOTS}`]: frame, ...outcomeUpdates(box.outcome) })
  if ((lobby.roundsPlayed ?? 0) !== box.roundsBefore) after(() => syncLog(firebase, instanceId, lobby))

  return Response.json(await publicView(firebase, instanceId, lobby, userId))
}

type OutcomeEffects = { chipDeltas?: Record<string, number>; potRefundTotal?: number; redealBonusIds?: string[] }

/** The chip payouts/charges, pot refund and "Deal på ny" bonuses a mutation produced, as one set of server-side increments -
 * no read-then-write, so they can't collide with anything else touching the same balance (the bot, another game). */
function outcomeUpdates(outcome: OutcomeEffects): Record<string, unknown> {
  const updates: Record<string, unknown> = {}
  for (const [id, delta] of Object.entries(outcome.chipDeltas ?? {})) if (delta) updates[`users/${id}/chips`] = increment(delta)
  for (const id of outcome.redealBonusIds ?? []) updates[`users/${id}/effects/positive/blackjackReDeals`] = increment(1)
  // Into the pending pot, which the bot drains into the real one - see FirebaseHelper.addToDeathrollPot.
  if (outcome.potRefundTotal) updates["other/deathrollPotPending"] = increment(outcome.potRefundTotal)
  return updates
}

/** The host leaving closes the table for everyone (deleted outright); anyone else leaving (player or
 * spectator) just frees their seat. A lobby with no players left is cleaned up either way - but
 * spectators alone don't keep an otherwise-empty lobby alive. `reason` only changes the announcement:
 * "disconnected" is what the presence sweep passes for someone who stopped polling. */
async function leaveLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string, userId: string, reason: "left" | "disconnected" = "left") {
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return
  const seated = !!lobby.players[userId]
  if (!seated && lobby.spectators[userId] === undefined) return

  if (seated && (lobby.hostId === userId || lobby.playerOrder.length <= 1)) {
    await closeLog(firebase, instanceId, lobby, lobby.hostId === userId ? "Bordet ble stengt - verten dro" : "Bordet ble stengt - ingen igjen", reason)
    await deleteLobby(firebase, instanceId, lobbyId)
    return
  }

  const box: { outcome: OutcomeEffects; resolved: boolean } = { outcome: {}, resolved: false }
  const next = await updateLobby(firebase, instanceId, lobbyId, (current) => {
    box.outcome = {}
    box.resolved = false
    if (current.spectators[userId] !== undefined) {
      delete current.spectators[userId]
      return current
    }
    if (!current.players[userId]) return undefined

    delete current.players[userId]
    current.playerOrder = current.playerOrder.filter((id) => id !== userId)
    // A vote the leaver started can never be answered by them - drop it rather than leave a dead banner.
    if (current.redealVote?.requestedBy === userId) delete current.redealVote
    if (current.betVote?.requestedBy === userId) delete current.betVote

    // Someone vanishing mid-round mustn't leave the others waiting on a hand that will never be played: if everyone still
    // at the table is now done, the round resolves right here. The leaver's stake stays forfeited, as with any manual leave.
    if (current.status !== "playing" || !allPlayersDone(current)) return current
    const roundOverAtBefore = current.roundOverAt
    const resolved = resolveDealer(current)
    applyToPotBankrolls(resolved.lobby, resolved.chipDeltas)
    box.outcome = { chipDeltas: resolved.chipDeltas, potRefundTotal: resolved.potRefundTotal, redealBonusIds: settleRound(resolved.lobby, roundOverAtBefore) }
    box.resolved = true
    return resolved.lobby
  })

  const updates = { ...outcomeUpdates(box.outcome), [`${presencePath(instanceId, lobbyId)}/${userId}`]: null }
  await firebase.updateData(updates)
  if (next && box.resolved) after(() => syncLog(firebase, instanceId, next))
}

/** Removes seated players and spectators whose polling has gone quiet (see the presence notes above). Never touches the
 * caller - they're demonstrably here. Someone with no stamp at all just hasn't polled yet, which isn't a disconnect.
 * Returns whether anything changed, so the caller knows to re-read the lobby. */
async function sweepDisconnected(firebase: FirebaseHelper, instanceId: string, lobby: BlackjackLobby, callerId: string, presence: Presence): Promise<boolean> {
  const now = Date.now()
  let changed = false
  for (const id of [...lobby.playerOrder, ...Object.keys(lobby.spectators)]) {
    const seen = presence[id]
    if (id === callerId || typeof seen !== "number" || now - seen < DISCONNECT_AFTER_MS) continue
    await leaveLobby(firebase, instanceId, lobby.id, id, "disconnected")
    changed = true
  }
  return changed
}

/** You can only ever be at one lobby per voice channel at a time - playing or spectating - switching
 * (or creating a new one) quietly leaves whichever one you were previously at. */
async function leaveOtherLobbies(firebase: FirebaseHelper, instanceId: string, userId: string, exceptLobbyId?: string) {
  const all = await readAllLobbies(firebase, instanceId)
  for (const lobbyId of Object.keys(all)) {
    if (lobbyId === exceptLobbyId) continue
    if (all[lobbyId].spectators[userId] !== undefined) await leaveLobby(firebase, instanceId, lobbyId, userId)
    if (all[lobbyId].players[userId]) await leaveLobby(firebase, instanceId, lobbyId, userId)
  }
}

/** What every player sees - identical for everyone except the dealer's hole card (hidden while a
 * round is in progress) - plus the caller's own current chip balance, read fresh every time so it
 * never goes stale across a round reset or a payout that just landed. */
/** Everyone with a stake in the current round - sitting-out players didn't ante, so they don't get a vote. */
function activeVoterIds(lobby: BlackjackLobby): string[] {
  return lobby.playerOrder.filter((id) => !lobby.players[id].sittingOut)
}

/** The same view as a plain function of the lobby and the viewer's own balance - frames (see above) are made from it with no viewer at all. */
function tableView(lobby: BlackjackLobby, userId: string, me: { chips?: number; redeals?: number }) {
  const dealerHand = lobby.dealerHidden ? [lobby.dealerHand[0], { rank: "?", suit: "?" as const }] : lobby.dealerHand
  return {
    id: lobby.id,
    version: lobby.updatedAt,
    hostId: lobby.hostId,
    status: lobby.status,
    buyIn: lobby.buyIn,
    frameSeq: lobby.frameSeq ?? 0,
    myGotRedealBonus: !!lobby.redealBonusIds?.includes(userId),
    myChips: me.chips ?? 0,
    myRedealsAvailable: me.redeals ?? 0,
    myPotBankroll: lobby.players[userId]?.potBankroll,
    iAmPlaying: !!lobby.players[userId],
    iAmSpectating: lobby.spectators[userId] !== undefined,
    spectators: Object.entries(lobby.spectators).map(([id, s]) => ({ id, username: s.username, avatar: discordAvatarUrl(id, s.avatar, 32) })),
    players: lobby.playerOrder.map((id) => {
      const p = lobby.players[id]
      return {
        id: p.id,
        username: p.username,
        avatar: discordAvatarUrl(p.id, p.avatar, 48),
        sittingOut: p.sittingOut,
        hands: p.hands.map((h) => ({ cards: h.cards, status: h.status, value: handValue(h.cards), doubled: !!h.doubled })),
      }
    }),
    dealer: { hand: dealerHand, value: lobby.dealerHidden ? undefined : handValue(lobby.dealerHand) },
    results: lobby.results,
    potRefunds: lobby.potRefunds,
    redealVote: lobby.redealVote
      ? {
          requestedBy: lobby.redealVote.requestedBy,
          requestedByUsername: lobby.players[lobby.redealVote.requestedBy]?.username ?? "?",
          yesCount: Object.keys(lobby.redealVote.votes).length,
          totalNeeded: activeVoterIds(lobby).length,
          myVoted: !!lobby.redealVote.votes[userId],
        }
      : undefined,
    myRedealDeniedThisRound: !!lobby.redealDeniedFor?.includes(userId),
    betVote: lobby.betVote
      ? {
          proposedBuyIn: lobby.betVote.proposedBuyIn,
          requestedBy: lobby.betVote.requestedBy,
          requestedByUsername: lobby.players[lobby.betVote.requestedBy]?.username ?? "?",
          yesCount: Object.keys(lobby.betVote.votes).length,
          totalNeeded: activeVoterIds(lobby).length,
          myVoted: !!lobby.betVote.votes[userId],
        }
      : undefined,
    roundOverAt: lobby.status === "roundOver" ? lobby.roundOverAt : undefined,
    roundStartCooldownMs: ROUND_START_COOLDOWN_MS,
  }
}

const redealsPath = (userId: string) => `users/${userId}/effects/positive/blackjackReDeals`

/** The two numbers a table shows about the viewer - read on their own, not as part of the whole (large) user record. */
async function readMe(firebase: FirebaseHelper, userId: string) {
  const [chips, redeals] = await Promise.all([firebase.getChips(userId), firebase.getData(redealsPath(userId))])
  return { chips, redeals: (redeals as number | undefined) ?? 0 }
}

async function publicView(firebase: FirebaseHelper, instanceId: string, lobby: BlackjackLobby, userId: string) {
  const [me, chat] = await Promise.all([readMe(firebase, userId), readChatTail(firebase, chatPath(instanceId, lobby.id))])
  return { ...tableView(lobby, userId, me), chat }
}

function isPlayerDone(player: BlackjackPlayer): boolean {
  return player.sittingOut || player.hands.every((h) => h.status !== "playing")
}

function allPlayersDone(lobby: BlackjackLobby): boolean {
  return lobby.playerOrder.every((id) => isPlayerDone(lobby.players[id]))
}

/** The hand a player's next Hit/Stand/Split applies to - always the leftmost one still in play. */
function activeHandIndex(player: BlackjackPlayer): number {
  return player.hands.findIndex((h) => h.status === "playing")
}

/** Dealer draws to 17 (stands on all 17s), every hand still in gets scored, and win/push payouts are
 * computed - never applied here directly (this is called from inside a lobby transaction, which can
 * run more than once; crediting chips as a side effect of the callback itself would double-pay on a
 * retry). The caller applies `chipDeltas`/`potRefundTotal` for real, exactly once, after the
 * transaction actually commits - see runLobbyMutation. */
function resolveDealer(lobby: BlackjackLobby): { lobby: BlackjackLobby; chipDeltas: Record<string, number>; potRefundTotal: number } {
  let deck = lobby.deck
  let dealerHand = lobby.dealerHand
  lobby.dealerHidden = false

  const anyoneStillIn = lobby.playerOrder.some((id) => {
    const p = lobby.players[id]
    return !p.sittingOut && p.hands.some((h) => h.status !== "bust")
  })
  if (anyoneStillIn) {
    while (handValue(dealerHand) < 17) {
      const drawn = drawCard(deck)
      dealerHand = [...dealerHand, drawn.card]
      deck = drawn.remaining
    }
  }

  const dealerTotal = handValue(dealerHand)
  const dealerBust = dealerTotal > 21
  const dealerBlackjack = isBlackjack(dealerHand)

  const results: Record<string, Result[]> = {}
  const chipDeltas: Record<string, number> = {}
  // "Tilbakelegg" - half of a losing hand's original deathroll-pot stake goes back into the pot,
  // same rule the old solo bot game applied (see commands/games/blackjack.ts's updatePot/busted).
  // Keyed per player so the client can tell *whose* loss triggered a given refund.
  const potRefunds: Record<string, number> = {}
  for (const id of lobby.playerOrder) {
    const player = lobby.players[id]
    if (player.sittingOut) continue // didn't ante this round, nothing to score

    const handResults: Result[] = []
    for (const hand of player.hands) {
      let result: Result
      if (hand.status === "bust") result = "lose"
      else if (hand.status === "blackjack") result = dealerBlackjack ? "push" : "blackjack"
      else if (dealerBust) result = "win"
      else {
        const handTotal = handValue(hand.cards)
        result = handTotal > dealerTotal ? "win" : handTotal < dealerTotal ? "lose" : "push"
      }
      handResults.push(result)

      const payout = Math.floor(handStake(lobby, hand) * PAYOUT_MULTIPLIER[result])
      if (payout > 0) chipDeltas[id] = (chipDeltas[id] ?? 0) + payout
      if (result === "lose" && player.deathrollPotStake > 0 && blackjackValues.deathrollRefundEnabled) {
        potRefunds[id] = (potRefunds[id] ?? 0) + Math.floor(player.deathrollPotStake * 0.5)
      }
    }
    results[id] = handResults
  }

  const totalPotRefund = Object.values(potRefunds).reduce((sum, n) => sum + n, 0)

  // A redeal vote that never reached unanimity or an explicit "no" (e.g. everyone else's hands
  // just finished naturally while it sat open) must not survive into the next round - otherwise a
  // player who'd already voted "yes" sees a dead "waiting for the others" banner with no way to
  // act on a fresh hand next round (the exact soft-lock this used to cause with a natural blackjack).
  delete lobby.redealVote
  delete lobby.redealDeniedFor
  delete lobby.potRefunds
  return {
    lobby: {
      ...lobby,
      deck,
      dealerHand,
      status: "roundOver",
      results,
      roundOverAt: Date.now(),
      ...(totalPotRefund > 0 ? { potRefunds } : {}),
    },
    chipDeltas,
    potRefundTotal: totalPotRefund,
  }
}

/** Test-only hook (see TestCommands' /test in the bot repo): forces a player's next opening hand to
 * a specific rank pair instead of a real draw, so split can be tested without waiting for a natural
 * pair. Set at other/pendingBlackjackTestHand/{userId}; the caller resolves and clears this before/
 * after the transaction (see performDeal/dealBlackjackRound) since it needs an async Firebase read. */
function drawOpeningHand(deck: Card[], forcedRank: string | undefined): { hand: Card[]; remaining: Card[] } {
  if (forcedRank) {
    const suits: Card["suit"][] = ["♠", "♥"]
    return { hand: [{ rank: forcedRank, suit: suits[0] }, { rank: forcedRank, suit: suits[1] }], remaining: deck }
  }
  const first = drawCard(deck)
  const second = drawCard(first.remaining)
  return { hand: [first.card, second.card], remaining: second.remaining }
}

/** Charges every seated player the lobby's buy-in (skipping anyone who can't afford it - they sit
 * out this round rather than being removed from the table) and deals a fresh round. Pure/sync, same
 * reasoning as resolveDealer: ante charges come back as `chipDeltas` for the caller to apply once,
 * after the transaction commits, not as a side effect here. `chips` is each player's balance as of
 * the moment this specific attempt started - read fresh by the caller right before each transaction
 * attempt, since a stale balance could let someone ante in on a hand they can no longer afford. */
function performDeal(
  lobby: BlackjackLobby,
  chips: Record<string, number>,
  testHands: Record<string, string | undefined>
): { lobby: BlackjackLobby; chipDeltas: Record<string, number>; potRefundTotal: number } {
  const buyIn = lobby.buyIn
  let deck = freshShuffledDeck()
  const chipDeltas: Record<string, number> = {}

  for (const id of lobby.playerOrder) {
    const balance = spendable(lobby.players[id], chips[id] ?? 0)
    if (balance < buyIn) {
      lobby.players[id] = { ...lobby.players[id], sittingOut: true, hands: [] }
      continue
    }
    if (buyIn > 0) chipDeltas[id] = (chipDeltas[id] ?? 0) - buyIn

    const cards = drawOpeningHand(deck, testHands[id])
    deck = cards.remaining
    lobby.players[id] = { ...lobby.players[id], sittingOut: false, hasPlayed: true, hands: [{ cards: cards.hand, status: isBlackjack(cards.hand) ? "blackjack" : "playing" }] }
  }

  const dealerFirst = drawCard(deck)
  const dealerSecond = drawCard(dealerFirst.remaining)
  lobby.dealerHand = [dealerFirst.card, dealerSecond.card]
  lobby.deck = dealerSecond.remaining
  lobby.dealerHidden = true
  lobby.status = "playing"
  delete lobby.results
  delete lobby.redealDeniedFor
  delete lobby.potRefunds

  if (!allPlayersDone(lobby)) return { lobby, chipDeltas, potRefundTotal: 0 }

  const resolved = resolveDealer(lobby)
  const mergedDeltas = { ...chipDeltas }
  for (const [id, delta] of Object.entries(resolved.chipDeltas)) mergedDeltas[id] = (mergedDeltas[id] ?? 0) + delta
  return { lobby: resolved.lobby, chipDeltas: mergedDeltas, potRefundTotal: resolved.potRefundTotal }
}

/** Reshuffles a fresh two cards for every active player (collapsing any splits) - no new antes,
 * it's a free do-over of the hands already dealt, not a new round. Sitting-out players stay out. */
function performRedeal(lobby: BlackjackLobby): BlackjackLobby {
  let deck = freshShuffledDeck()

  for (const id of lobby.playerOrder) {
    const player = lobby.players[id]
    if (player.sittingOut) continue
    const first = drawCard(deck)
    const second = drawCard(first.remaining)
    const cards = [first.card, second.card]
    lobby.players[id] = { ...player, hands: [{ cards, status: isBlackjack(cards) ? "blackjack" : "playing" }] }
    deck = second.remaining
  }

  const dealerFirst = drawCard(deck)
  const dealerSecond = drawCard(dealerFirst.remaining)
  lobby.dealerHand = [dealerFirst.card, dealerSecond.card]
  lobby.deck = dealerSecond.remaining
  lobby.dealerHidden = true
  lobby.status = "playing"
  delete lobby.results
  delete lobby.redealVote
  delete lobby.redealDeniedFor
  delete lobby.potRefunds

  return lobby
}

/** If every active player has now voted yes, redeals and signals that the requester's "Deal på ny"
 * needs consuming - otherwise leaves the vote pending. Pure/sync like resolveDealer: the actual
 * blackjackReDeals decrement happens in the caller, exactly once, after the transaction commits. */
function maybeApplyRedealVote(lobby: BlackjackLobby): {
  lobby: BlackjackLobby
  redealsConsumed: boolean
  chipDeltas?: Record<string, number>
  potRefundTotal?: number
} {
  if (!lobby.redealVote) return { lobby, redealsConsumed: false }
  const allYes = activeVoterIds(lobby).every((id) => lobby.redealVote!.votes[id])
  if (!allYes) return { lobby, redealsConsumed: false }
  const redealt = performRedeal(lobby)
  // The new deal can leave nobody with anything to do (everyone dealt a blackjack) - then it resolves straight away, same as a
  // first deal does, rather than waiting on a move nobody can make.
  if (!allPlayersDone(redealt)) return { lobby: redealt, redealsConsumed: true }
  const resolved = resolveDealer(redealt)
  return { lobby: resolved.lobby, redealsConsumed: true, chipDeltas: resolved.chipDeltas, potRefundTotal: resolved.potRefundTotal }
}

/** "Deal på ny" is a do-over of the hand you were dealt - once you've drawn a card (or split) you've played it, so it's no longer on offer.
 * Still on the opening two cards counts, natural blackjack included. */
function canStillRedeal(player: BlackjackPlayer | undefined): boolean {
  if (!player || player.sittingOut || player.hands.length !== 1) return false
  const hand = player.hands[0]
  return hand.cards.length === 2 && (hand.status === "playing" || hand.status === "blackjack")
}

/** Hitting or splitting means the caller has played their hand after all - a redeal vote they started is off. */
function dropOwnRedealVote(lobby: BlackjackLobby, userId: string) {
  if (lobby.redealVote?.requestedBy === userId) delete lobby.redealVote
}

export async function requestBlackjackRedeal(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const available = ((await firebase.getData(redealsPath(user.id))) as number | undefined) ?? 0

  // Reset on every run of the callback: only what the run that went through decided counts.
  let redealsConsumed = false
  const response = await runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    redealsConsumed = false
    if (!lobby.players[user.id]) return { error: "Du er ikke ved dette bordet" }
    if (lobby.status !== "playing") return { error: "Kan bare brukes midt i en runde" }
    if (!canStillRedeal(lobby.players[user.id])) return { error: "Du kan bare bruke \"Deal på ny\" før du har trukket et kort" }
    if (lobby.redealVote) return { error: "Det pågår allerede en avstemning om reshuffle" }
    if (lobby.redealDeniedFor?.includes(user.id)) {
      return { error: "Forespørselen din ble avvist denne runden - prøv igjen neste runde" }
    }
    if (available <= 0) return { error: 'Du har ingen "Deal på ny" igjen' }

    lobby.redealVote = { requestedBy: user.id, votes: { [user.id]: true }, createdAt: Date.now() }
    const resolved = maybeApplyRedealVote(lobby)
    redealsConsumed = resolved.redealsConsumed
    return { lobby: resolved.lobby, chipDeltas: resolved.chipDeltas, potRefundTotal: resolved.potRefundTotal }
  })

  if (redealsConsumed) await firebase.updateData({ [redealsPath(user.id)]: increment(-1) })
  return response
}

/** A single "no" cancels the vote outright - only unanimous "yes" ever triggers the redeal. */
export async function voteBlackjackRedeal(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser, approve: boolean) {
  const firebase = new FirebaseHelper()

  let redealsConsumed = false
  let requesterId: string | undefined
  const response = await runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    redealsConsumed = false
    if (!lobby.players[user.id]) return { error: "Du er ikke ved dette bordet" }
    if (!lobby.redealVote) return { error: "Ingen aktiv avstemning" }

    if (!approve) {
      lobby.redealDeniedFor = [...(lobby.redealDeniedFor ?? []), lobby.redealVote.requestedBy]
      delete lobby.redealVote
      return { lobby }
    }

    lobby.redealVote.votes[user.id] = true
    requesterId = lobby.redealVote.requestedBy
    const resolved = maybeApplyRedealVote(lobby)
    redealsConsumed = resolved.redealsConsumed
    return { lobby: resolved.lobby, chipDeltas: resolved.chipDeltas, potRefundTotal: resolved.potRefundTotal }
  })

  if (redealsConsumed && requesterId) await firebase.updateData({ [redealsPath(requesterId)]: increment(-1) })
  return response
}

/** If every currently-active player (seated and not sitting out - same pool "Deal på ny" polls) has
 * now voted yes, applies the proposed buy-in and clears the vote - otherwise leaves it pending.
 * Returns the lobby unchanged either way if there's no vote. No async side effects, so unlike the
 * redeal vote this needs no extra plumbing to stay transaction-safe. */
function maybeApplyBetVote(lobby: BlackjackLobby): BlackjackLobby {
  if (!lobby.betVote) return lobby
  const allYes = activeVoterIds(lobby).every((id) => lobby.betVote!.votes[id])
  if (!allYes) return lobby
  const { betVote, ...rest } = lobby
  return { ...rest, buyIn: betVote.proposedBuyIn }
}

/** Changes the table's buy-in while nobody's mid-round. Lowering it (or the lone active player
 * adjusting their own table - sitting-out players don't count, same as "Deal på ny") applies
 * immediately - nobody's put at more risk by that. Raising it with more than one active player
 * needs a unanimous vote instead, same shape as "Deal på ny". `allIn: true` proposes the caller's
 * own current chip balance rather than a specific number. */
export async function adjustBlackjackBet(
  instanceId: string,
  lobbyId: string,
  user: AuthenticatedDiscordUser,
  buyInInput: unknown,
  allIn: boolean
) {
  const firebase = new FirebaseHelper()
  const myChips = await firebase.getChips(user.id)

  return runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    const player = lobby.players[user.id]
    if (!player) return { error: "Du er ikke ved dette bordet" }
    if (lobby.status === "playing") return { error: "Kan ikke endre satsing midt i en runde" }

    const available = spendable(player, myChips)
    const proposedBuyIn = allIn ? available : Math.max(0, Math.floor(Number(buyInInput) || 0))
    if (proposedBuyIn === lobby.buyIn) return { lobby }
    if (player.potBankroll !== undefined && proposedBuyIn > available) {
      return { error: `Du spiller med pott-pengene - du kan satse maks ${available} chips` }
    }

    if (proposedBuyIn < lobby.buyIn || activeVoterIds(lobby).length <= 1) {
      lobby.buyIn = proposedBuyIn
      delete lobby.betVote
      return { lobby }
    }

    lobby.betVote = { proposedBuyIn, requestedBy: user.id, votes: { [user.id]: true }, createdAt: Date.now() }
    return { lobby: maybeApplyBetVote(lobby) }
  })
}

/** A single "no" cancels the vote outright - only unanimous "yes" ever raises the buy-in. */
export async function voteBlackjackBet(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser, approve: boolean) {
  const firebase = new FirebaseHelper()
  return runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    if (!lobby.players[user.id]) return { error: "Du er ikke ved dette bordet" }
    if (!lobby.betVote) return { error: "Ingen aktiv avstemning" }

    if (!approve) {
      delete lobby.betVote
      return { lobby }
    }

    lobby.betVote.votes[user.id] = true
    return { lobby: maybeApplyBetVote(lobby) }
  })
}

/** An auto-start only counts for this long after the bot wrote it (or refreshed it - it does that when the winner clicks "Spill
 * Blackjack", however long after the win that is). Without a limit, one that was never used stayed armed forever: days later, opening
 * the Activity for anything at all sent its owner into blackjack at a table with the old pot as buy-in. A stale one is ignored, not
 * deleted - the button can still bring it back. */
const AUTO_START_VALID_MS = 10 * 60 * 1000

function isFreshAutoStart(pending: any): boolean {
  return !!pending && typeof pending.createdAt === "number" && Date.now() - pending.createdAt < AUTO_START_VALID_MS
}

/** The bot writes here (other/pendingBlackjackAutoStart/{userId}) when the "Spill Blackjack" button
 * on a /terning pot win (or /blackjack vanlig) is used, so the caller's Activity session auto-creates
 * a lobby with that stake instead of landing on the plain lobby list.
 *
 * Deliberately non-destructive (unlike its name/old behavior used to suggest) - it only tells the
 * client whether to skip straight to creating a table and what buy-in to show while doing so.
 * createBlackjackLobby is the sole place that actually reads-and-clears the real flag server-side
 * and decides whether "tilbakelegg" applies - never trust a client-supplied fromDeathrollPot, since
 * that would let anyone claim free pot refunds on every future loss. */
export async function consumePendingBlackjackAutoStart(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const data = await firebase.getData(`other/pendingBlackjackAutoStart/${user.id}`)
  if (!isFreshAutoStart(data)) return Response.json({ buyIn: null })

  const buyIn = Math.max(0, Math.floor(Number(data.buyIn) || 0))
  if (buyIn <= 0) {
    // A real auto-start (deathroll pot win, or /blackjack vanlig's required stake) is never
    // legitimately 0 - if it parses to that, something upstream went wrong writing this flag.
    // Surfacing a silently free 0-buy-in table would be worse than just falling back to the lobby
    // list, so treat this the same as "nothing was pending" instead (createBlackjackLobby applies
    // the exact same guard when it does the real, destructive read). TEMPORARY: also logged so the
    // actual cause is visible in Vercel's function logs if this ever fires - remove the log once
    // confirmed this doesn't happen anymore.
    console.error("consumePendingBlackjackAutoStart: parsed buyIn <= 0 from non-null data", { userId: user.id, data })
    return Response.json({ buyIn: null })
  }

  return Response.json({ buyIn })
}

/** Boolean-only version for the home page to check whether it should redirect straight into
 * /multiplayer/blackjack - launchActivity() always opens the app's root URL with no way to deep-link
 * a path, so that's the only place the auto-start flag can actually be noticed and acted on. Never
 * deletes the flag - only createBlackjackLobby does that, exactly once, when it actually acts on it. */
export async function peekPendingBlackjackAutoStart(userId: string) {
  const firebase = new FirebaseHelper()
  const data = await firebase.getData(`other/pendingBlackjackAutoStart/${userId}`)
  return Response.json({ pending: isFreshAutoStart(data) })
}

export async function listBlackjackLobbies(instanceId: string, userId: string) {
  const firebase = new FirebaseHelper()
  const [first, presenceRaw] = await Promise.all([readAllLobbies(firebase, instanceId), firebase.getData(`other/${PRESENCE_PREFIX}/${instanceId}`)])
  let all = first
  const presence = (presenceRaw ?? {}) as Record<string, Presence>
  // Anyone browsing the list also cleans up tables whose players have all gone quiet - nobody's left at those to poll them.
  const swept = await Promise.all(Object.values(all).map((l) => sweepDisconnected(firebase, instanceId, l, userId, presence[l.id] ?? {})))
  if (swept.some(Boolean)) all = await readAllLobbies(firebase, instanceId)
  const lobbies = Object.values(all).map((l) => ({
    id: l.id,
    hostId: l.hostId,
    hostUsername: l.players[l.hostId]?.username ?? "?",
    buyIn: l.buyIn,
    numPlayers: l.playerOrder.length,
    numSpectators: Object.keys(l.spectators).length,
    status: l.status,
  }))
  const myLobbyId = Object.values(all).find((l) => l.players[userId] || l.spectators[userId] !== undefined)?.id ?? null
  return Response.json({ lobbies, myLobbyId })
}

export async function createBlackjackLobby(instanceId: string, user: AuthenticatedDiscordUser, buyInInput: unknown) {
  const firebase = new FirebaseHelper()
  const pendingPath = `other/pendingBlackjackAutoStart/${user.id}`
  const [channelId, pending, myChips] = await Promise.all([
    resolveAnnounceChannel(user.channelId),
    firebase.getData(pendingPath),
    firebase.getChips(user.id),
    leaveOtherLobbies(firebase, instanceId, user.id),
  ])

  // The client's buyInInput is only ever trusted for a genuinely manual "Start nytt bord" - if a
  // pending deathroll-pot auto-start flag actually exists server-side for this user, it (and whether
  // it's real pot money worth "tilbakelegg") always wins instead, consumed exactly once right here.
  // Never derive fromDeathrollPot from anything the client sent - that'd let anyone claim free
  // pot-loss refunds forever by just lying about it on an ordinary table.
  let buyIn = Math.max(0, Math.floor(Number(buyInInput) || 0))
  let fromDeathrollPot = false
  if (isFreshAutoStart(pending)) {
    await firebase.updateData({ [pendingPath]: null })
    const pendingBuyIn = Math.max(0, Math.floor(Number(pending.buyIn) || 0))
    if (pendingBuyIn > 0) {
      buyIn = pendingBuyIn
      fromDeathrollPot = !!pending.fromDeathrollPot
    }
  }

  if (myChips < buyIn) {
    return Response.json({ error: `Du har ikke nok chips til å starte med denne buy-innen (du har ${myChips}, krever ${buyIn})` }, { status: 400 })
  }

  const lobbyId = `${user.id}-${Date.now()}`
  const username = user.globalName ?? user.username
  const lobby: BlackjackLobby = {
    id: lobbyId,
    hostId: user.id,
    buyIn,
    status: "waiting",
    players: {
      [user.id]: {
        id: user.id,
        username,
        avatar: user.avatar,
        sittingOut: false,
        hands: [],
        startingChips: myChips,
        hasPlayed: false,
        // "Tilbakelegg" - half of every loss this player takes at this table gets refunded to the
        // deathroll pot, same as the old solo bot game did, but only for actual pot winnings (never
        // a manually-typed /blackjack vanlig stake) - see resolveDealer.
        deathrollPotStake: fromDeathrollPot ? buyIn : 0,
        ...(fromDeathrollPot ? { potBankroll: buyIn } : {}),
      },
    },
    playerOrder: [user.id],
    spectators: {},
    dealerHand: [],
    dealerHidden: false,
    deck: [],
    channelId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const logRef = await postLiveMessage(channelId, liveLogBody("Blackjack", logIntro(lobby), [], []))
  if (logRef) lobby.logRef = logRef
  await firebase.updateData({ [lobbyPath(instanceId, lobbyId)]: forDb(lobby), [`${presencePath(instanceId, lobbyId)}/${user.id}`]: Date.now() })
  return Response.json({ ...tableView(lobby, user.id, { chips: myChips }), chat: [] })
}

export async function joinBlackjackLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const [peek, myChips] = await Promise.all([readLobby(firebase, instanceId, lobbyId), firebase.getChips(user.id)])
  if (!peek) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })
  if (peek.players[user.id]) return Response.json(await publicView(firebase, instanceId, peek, user.id))
  if (myChips < peek.buyIn) {
    return Response.json({ error: `Du har ikke nok chips til å bli med (du har ${myChips}, krever ${peek.buyIn})` }, { status: 400 })
  }

  await leaveOtherLobbies(firebase, instanceId, user.id, lobbyId)
  const [lobby] = await Promise.all([
    updateLobby(firebase, instanceId, lobbyId, (current) => {
      if (current.players[user.id]) return undefined
      delete current.spectators[user.id]
      current.players[user.id] = {
        id: user.id,
        username: user.globalName ?? user.username,
        avatar: user.avatar,
        sittingOut: false,
        hands: [],
        startingChips: myChips,
        hasPlayed: false,
        deathrollPotStake: 0,
      }
      current.playerOrder.push(user.id)
      return current
    }),
    touchPresence(firebase, instanceId, lobbyId, user.id),
  ])
  if (!lobby) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })
  return Response.json(await publicView(firebase, instanceId, lobby, user.id))
}

/** Watch a table without playing - no ante, no seat, no cards, just the same live view everyone
 * else gets. A seated player can't spectate their own table (leave first); a spectator who wants to
 * play instead should use joinBlackjackLobby, which already clears them out of spectators. */
export async function spectateBlackjackLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const peek = await readLobby(firebase, instanceId, lobbyId)
  if (!peek) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })
  if (peek.players[user.id]) return Response.json({ error: "Du sitter allerede ved bordet" }, { status: 400 })
  if (peek.spectators[user.id] !== undefined) return Response.json(await publicView(firebase, instanceId, peek, user.id))

  await leaveOtherLobbies(firebase, instanceId, user.id, lobbyId)
  const [lobby] = await Promise.all([
    updateLobby(firebase, instanceId, lobbyId, (current) => {
      if (current.players[user.id]) return undefined
      current.spectators[user.id] = { username: user.globalName ?? user.username, avatar: user.avatar }
      return current
    }),
    touchPresence(firebase, instanceId, lobbyId, user.id),
  ])
  if (!lobby) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })
  return Response.json(await publicView(firebase, instanceId, lobby, user.id))
}

/** A pot-funded seat giving up the pot-money limit and carrying on with all their own chips. From here it's an ordinary seat:
 * no more "tilbakelegg" or "Deal på ny" bonus, since it's no longer pot money at stake. */
export async function playOnWithOwnChips(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  return runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    const player = lobby.players[user.id]
    if (!player) return { error: "Du er ikke ved dette bordet" }
    if (lobby.status === "playing") return { error: "Vent til runden er ferdig" }
    if (player.potBankroll === undefined) return { lobby }
    delete player.potBankroll
    player.deathrollPotStake = 0
    return { lobby }
  })
}

export async function leaveBlackjackLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  await leaveLobby(firebase, instanceId, lobbyId, user.id)
  return Response.json({ ok: true })
}

/** `since` is the last frame a spectator has already shown (see the frames notes above): anything newer comes back as `frames`, to be replayed in order. */
export async function getBlackjackLobbyStatus(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser, since?: number) {
  const firebase = new FirebaseHelper()
  // Everything a poll needs, asked for at once: a poll's latency is what everyone at the table feels as lag, and these are all
  // small, independent reads.
  const [first, presenceRaw, me, chat, framesRaw] = await Promise.all([
    readLobby(firebase, instanceId, lobbyId),
    firebase.getData(presencePath(instanceId, lobbyId)),
    readMe(firebase, user.id),
    readChatTail(firebase, chatPath(instanceId, lobbyId)),
    since !== undefined ? firebase.getData(framesPath(instanceId, lobbyId)) : undefined,
  ])
  let lobby = first
  if (!lobby) return Response.json({ closed: true })

  // This poll is the heartbeat - and the moment to notice anyone else's has stopped. The stamp is only rewritten once it's getting
  // old, and after the answer has gone out.
  const presence = (presenceRaw ?? {}) as Presence
  const present = !!lobby.players[user.id] || lobby.spectators[user.id] !== undefined
  const seen = presence[user.id]
  if (present && (typeof seen !== "number" || Date.now() - seen > PRESENCE_TOUCH_MS)) after(() => touchPresence(firebase, instanceId, lobbyId, user.id))

  if (await sweepDisconnected(firebase, instanceId, lobby, user.id, presence)) {
    lobby = await readLobby(firebase, instanceId, lobbyId)
    if (!lobby) return Response.json({ closed: true })
  }
  const frames = since !== undefined && lobby.spectators[user.id] !== undefined && (lobby.frameSeq ?? 0) > since ? framesSince(framesRaw, since) : []
  return Response.json({ ...tableView(lobby, user.id, me), chat, ...(frames.length > 0 ? { frames } : {}) })
}

export async function dealBlackjackRound(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()

  // Everything performDeal needs that requires an async Firebase read has to be resolved before the
  // transaction - its callback must stay synchronous. There's a small residual staleness window here
  // (these balances are a snapshot from just before the transaction, not re-read on a retry) -
  // acceptable since a retry only happens on genuine contention on this exact lobby.
  const peek = await readLobby(firebase, instanceId, lobbyId)
  if (!peek) return Response.json({ closed: true }, { status: 404 })
  const chips: Record<string, number> = {}
  const testHands: Record<string, string | undefined> = {}
  await Promise.all(
    peek.playerOrder.map(async (id) => {
      const [balance, testHand] = await Promise.all([firebase.getChips(id), firebase.getData(`other/pendingBlackjackTestHand/${id}`)])
      chips[id] = balance
      testHands[id] = testHand?.rank
    })
  )

  const response = await runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    if (!lobby.players[user.id]) return { error: "Du er ikke ved dette bordet" }
    if (lobby.status === "playing") return { error: "En runde pågår allerede" }
    if (lobby.status === "roundOver" && lobby.roundOverAt) {
      const remaining = ROUND_START_COOLDOWN_MS - (Date.now() - lobby.roundOverAt)
      if (remaining > 0) return { error: "Vent litt før neste runde", status: 429 }
    }
    return performDeal(lobby, chips, testHands)
  })

  const usedTestHands = Object.keys(testHands).filter((id) => testHands[id])
  if (usedTestHands.length > 0) await firebase.updateData(Object.fromEntries(usedTestHands.map((id) => [`other/pendingBlackjackTestHand/${id}`, null])))
  return response
}

export async function hitBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  return runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    const player = lobby.players[user.id]
    const handIndex = player ? activeHandIndex(player) : -1
    if (!player || lobby.status !== "playing" || handIndex === -1) {
      return { error: "Ikke din tur akkurat nå" }
    }

    dropOwnRedealVote(lobby, user.id)
    const hand = player.hands[handIndex]
    const drawn = drawCard(lobby.deck)
    const cards = [...hand.cards, drawn.card]
    lobby.deck = drawn.remaining
    player.hands[handIndex] = { cards, status: handValue(cards) > 21 ? "bust" : "playing" }

    return allPlayersDone(lobby) ? resolveDealer(lobby) : { lobby }
  })
}

export async function standBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  return runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    const player = lobby.players[user.id]
    const handIndex = player ? activeHandIndex(player) : -1
    if (!player || lobby.status !== "playing" || handIndex === -1) {
      return { error: "Ikke din tur akkurat nå" }
    }

    dropOwnRedealVote(lobby, user.id)
    player.hands[handIndex] = { ...player.hands[handIndex], status: "stood" }

    return allPlayersDone(lobby) ? resolveDealer(lobby) : { lobby }
  })
}

/** Double down: on any hand still on its first two cards (split hands included), put in one more buy-in, take exactly one card,
 * and the hand stands - it then stakes and pays double (see handStake). */
export async function doubleBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  // Same residual-staleness note as splitBlackjack.
  const myChips = await firebase.getChips(user.id)

  return runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    const player = lobby.players[user.id]
    const handIndex = player ? activeHandIndex(player) : -1
    if (!player || lobby.status !== "playing" || handIndex === -1) {
      return { error: "Ikke din tur akkurat nå" }
    }

    const hand = player.hands[handIndex]
    if (hand.cards.length !== 2) return { error: "Du kan bare doble på de to første kortene" }
    const available = spendable(player, myChips)
    if (available < lobby.buyIn) {
      return { error: `Ikke nok chips til å doble (du har ${available}, krever ${lobby.buyIn} til)` }
    }

    dropOwnRedealVote(lobby, user.id)
    const drawn = drawCard(lobby.deck)
    const cards = [...hand.cards, drawn.card]
    lobby.deck = drawn.remaining
    player.hands[handIndex] = { cards, status: handValue(cards) > 21 ? "bust" : "stood", doubled: true }
    const chipDeltas: Record<string, number> = lobby.buyIn > 0 ? { [user.id]: -lobby.buyIn } : {}

    if (!allPlayersDone(lobby)) return { lobby, chipDeltas }
    const resolved = resolveDealer(lobby)
    const mergedDeltas = { ...chipDeltas }
    for (const [id, delta] of Object.entries(resolved.chipDeltas)) mergedDeltas[id] = (mergedDeltas[id] ?? 0) + delta
    return { lobby: resolved.lobby, chipDeltas: mergedDeltas, potRefundTotal: resolved.potRefundTotal }
  })
}

/** House rule: any two matching-rank cards can be split, including a hand that's already the
 * result of a split (drawing a third matching card lets you split again), as long as the buy-in
 * for the new hand is affordable. Each split hand is a fully separate bet from here on. */
export async function splitBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  // Same residual-staleness note as dealBlackjackRound: a snapshot from just before the transaction,
  // re-used on a retry rather than re-read - only matters under genuine contention on this lobby.
  const myChips = await firebase.getChips(user.id)

  return runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    const player = lobby.players[user.id]
    const handIndex = player ? activeHandIndex(player) : -1
    if (!player || lobby.status !== "playing" || handIndex === -1) {
      return { error: "Ikke din tur akkurat nå" }
    }

    const hand = player.hands[handIndex]
    if (hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank) {
      return { error: "Denne hånden kan ikke splittes" }
    }
    const available = spendable(player, myChips)
    if (available < lobby.buyIn) {
      return { error: `Ikke nok chips til å splitte (du har ${available}, krever ${lobby.buyIn} til)` }
    }

    dropOwnRedealVote(lobby, user.id)
    let deck = lobby.deck
    const firstDraw = drawCard(deck)
    const secondDraw = drawCard(firstDraw.remaining)
    deck = secondDraw.remaining

    // A post-split 21 is just 21, not a natural blackjack (that only counts on the original two
    // cards) - standard house rule, and the reason these use handValue > 21 rather than isBlackjack.
    const handA: PlayerHand = { cards: [hand.cards[0], firstDraw.card], status: "playing" }
    const handB: PlayerHand = { cards: [hand.cards[1], secondDraw.card], status: "playing" }
    if (handValue(handA.cards) > 21) handA.status = "bust"
    if (handValue(handB.cards) > 21) handB.status = "bust"

    player.hands.splice(handIndex, 1, handA, handB)
    lobby.deck = deck
    const chipDeltas: Record<string, number> = lobby.buyIn > 0 ? { [user.id]: -lobby.buyIn } : {}

    if (!allPlayersDone(lobby)) return { lobby, chipDeltas }
    const resolved = resolveDealer(lobby)
    const mergedDeltas = { ...chipDeltas }
    for (const [id, delta] of Object.entries(resolved.chipDeltas)) mergedDeltas[id] = (mergedDeltas[id] ?? 0) + delta
    return { lobby: resolved.lobby, chipDeltas: mergedDeltas, potRefundTotal: resolved.potRefundTotal }
  })
}

/** The bot's "Spill Blackjack" button (a /terning pot win) writes other/pendingBlackjackSpectate/{clickerId} when someone other than the
 * winner clicks it, right before launching the Activity - which can only open at the root page, so the hub calls this to find out
 * whose table to go and watch. Consumed on read; a stale one (older than 10 minutes) is ignored. */
export async function consumePendingBlackjackSpectate(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const pending = await firebase.getData(`other/pendingBlackjackSpectate/${user.id}`)
  if (!pending) return Response.json({ hostId: null })
  await firebase.updateData({ [`other/pendingBlackjackSpectate/${user.id}`]: null })
  const fresh = typeof pending.createdAt === "number" && Date.now() - pending.createdAt < 10 * 60 * 1000
  return Response.json({ hostId: fresh && pending.hostId ? String(pending.hostId) : null })
}
