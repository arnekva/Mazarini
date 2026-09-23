import { isAdminUser } from "./admin"
import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { Card, drawCard, freshShuffledDeck, handValue, isBlackjack } from "./blackjack"
import { discordAvatarUrl } from "./discordAvatar"
import { postChannelMessage } from "./discordMessage"
import { ANNOUNCE_CHANNEL_ID } from "./gameValues"

type HandStatus = "playing" | "stood" | "bust" | "blackjack"
type TableStatus = "waiting" | "playing" | "roundOver"
type Result = "win" | "lose" | "push" | "blackjack"

interface PlayerHand {
  cards: Card[]
  status: HandStatus
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
  createdAt: number
  updatedAt: number
}

/** Minimum time between a round resolving and the next one being dealable - gives every polling
 * client (TABLE_POLL_MS = 1500ms) at least one refresh to catch the "roundOver" state and stop
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
      hands: (p.hands ?? []).map((h: any) => ({ cards: h.cards ?? [], status: h.status })),
      startingChips: p.startingChips ?? 0,
      hasPlayed: p.hasPlayed ?? false,
      deathrollPotStake: p.deathrollPotStake ?? 0,
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
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? Date.now(),
  }
}

async function readLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string): Promise<BlackjackLobby | null> {
  const data = await firebase.getData(`other/${PATH_PREFIX}/${instanceId}/${lobbyId}`)
  return data ? normalizeLobby({ id: lobbyId, ...data }) : null
}

async function readAllLobbies(firebase: FirebaseHelper, instanceId: string): Promise<Record<string, BlackjackLobby>> {
  const data = (await firebase.getData(`other/${PATH_PREFIX}/${instanceId}`)) ?? {}
  const result: Record<string, BlackjackLobby> = {}
  for (const lobbyId of Object.keys(data)) result[lobbyId] = normalizeLobby({ id: lobbyId, ...data[lobbyId] })
  return result
}

async function writeLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string, lobby: BlackjackLobby) {
  await firebase.updateData({ [`other/${PATH_PREFIX}/${instanceId}/${lobbyId}`]: { ...lobby, updatedAt: Date.now() } })
}

async function deleteLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string) {
  await firebase.updateData({ [`other/${PATH_PREFIX}/${instanceId}/${lobbyId}`]: null })
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
}

type LobbyMutationResult = LobbyMutationOutcome | { error: string; status?: number }

// NOTE: this was briefly built on firebase/database's runTransaction() for real atomicity against
// concurrent requests, but that doesn't actually work from here - confirmed by direct testing, not a
// guess. The *client* SDK's transaction() relies on a listener-warmed local sync cache to know the
// "current" value; a fresh one-shot Node connection (exactly what every serverless function call is)
// has no such cache, so its callback fires with `raw = null` on the very first invocation even when
// the data verifiably exists on the server (confirmed: a plain getData() on the same path immediately
// before returns the real value, then runTransaction's callback still sees null). Treating that null
// as "doesn't exist" aborted every single call - it broke starting a new round outright in production.
// A real fix would need firebase-admin's server-side transaction() instead (different auth - a
// service account, not the apiKey config this app uses) - out of scope until that's set up. Back to
// plain get-then-write for now, same shape the rest of this file already uses; the compute/chipDeltas
// split is kept since it's good structure regardless of atomicity.
async function runLobbyMutation(
  firebase: FirebaseHelper,
  instanceId: string,
  lobbyId: string,
  userId: string,
  compute: (lobby: BlackjackLobby) => LobbyMutationResult
): Promise<Response> {
  const path = `other/${PATH_PREFIX}/${instanceId}/${lobbyId}`
  const raw = await firebase.getData(path)
  if (raw == null) return Response.json({ closed: true }, { status: 404 })

  const lobby = normalizeLobby({ id: lobbyId, ...raw })
  const result = compute(lobby)
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status ?? 400 })

  await firebase.updateData({ [path]: { ...result.lobby, updatedAt: Date.now() } })

  if (result.chipDeltas) {
    for (const [id, delta] of Object.entries(result.chipDeltas)) {
      if (!delta) continue
      const dbUser = (await firebase.getUser(id)) ?? {}
      await firebase.updateUserFields(id, { chips: (dbUser.chips ?? 0) + delta })
    }
  }
  if (result.potRefundTotal) {
    const currentPot = (await firebase.getData("other/deathrollPot")) ?? 0
    await firebase.updateData({ "other/deathrollPot": currentPot + result.potRefundTotal })
  }

  return Response.json(await publicView(firebase, result.lobby, userId))
}

/** Announces a leaving player's session result in Discord - only for someone who actually played at
 * least one round (not someone who sat down and immediately left), since only then does a chip
 * delta mean anything. Never lets a failed Discord post block the actual leave. */
async function announcePlayerLeft(firebase: FirebaseHelper, player: BlackjackPlayer) {
  if (!player.hasPlayed) return
  try {
    const dbUser = (await firebase.getUser(player.id)) ?? {}
    const delta = (dbUser.chips ?? 0) - player.startingChips
    const sign = delta >= 0 ? "+" : ""
    await postChannelMessage(ANNOUNCE_CHANNEL_ID, {
      content: `${player.username} gikk fra Blackjack-bordet med ${sign}${delta} chips.`,
    })
  } catch {
    // Best-effort announcement only - the leave itself must still go through either way.
  }
}

/** The host leaving closes the table for everyone (deleted outright); anyone else leaving (player or
 * spectator) just frees their seat. A lobby with no players left is cleaned up either way - but
 * spectators alone don't keep an otherwise-empty lobby alive. */
async function leaveLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string, userId: string) {
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return

  if (lobby.spectators[userId] !== undefined) {
    const spectators = { ...lobby.spectators }
    delete spectators[userId]
    await writeLobby(firebase, instanceId, lobbyId, { ...lobby, spectators })
    return
  }
  if (!lobby.players[userId]) return
  const leavingPlayer = lobby.players[userId]

  if (lobby.hostId === userId) {
    await deleteLobby(firebase, instanceId, lobbyId)
    await announcePlayerLeft(firebase, leavingPlayer)
    return
  }
  const playerOrder = lobby.playerOrder.filter((id) => id !== userId)
  if (playerOrder.length === 0) {
    await deleteLobby(firebase, instanceId, lobbyId)
    await announcePlayerLeft(firebase, leavingPlayer)
    return
  }
  const players = { ...lobby.players }
  delete players[userId]
  await writeLobby(firebase, instanceId, lobbyId, { ...lobby, players, playerOrder })
  await announcePlayerLeft(firebase, leavingPlayer)
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

async function publicView(firebase: FirebaseHelper, lobby: BlackjackLobby, userId: string) {
  const dealerHand = lobby.dealerHidden ? [lobby.dealerHand[0], { rank: "?", suit: "?" as const }] : lobby.dealerHand
  const dbUser = (await firebase.getUser(userId)) ?? {}
  return {
    id: lobby.id,
    hostId: lobby.hostId,
    status: lobby.status,
    buyIn: lobby.buyIn,
    myChips: dbUser.chips ?? 0,
    myRedealsAvailable: dbUser.effects?.positive?.blackjackReDeals ?? 0,
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
        hands: p.hands.map((h) => ({ cards: h.cards, status: h.status, value: handValue(h.cards) })),
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

/** Draws the dealer's next hit card - normally random. If a nudge is armed for this table, it's
 * consumed right here either way (one shot, never repeats) - but it only actually changes anything
 * when the total's already 12+, where a high card is unambiguously bad for the dealer. Below that,
 * a high card would just lock in a strong stand instead, so it's left fully random on purpose.
 * Pure/sync (the "is a nudge armed" flag must be resolved by the caller, before the transaction that
 * calls this - see forceBadDealerDraw/runLobbyMutation) so this can run inside a lobby transaction. */
function drawDealerCard(deck: Card[], dealerHand: Card[], forcedAvailable: boolean): { card: Card; remaining: Card[]; consumedForced: boolean } {
  if (forcedAvailable && handValue(dealerHand) >= 12) {
    const highRanks = ["10", "J", "Q", "K"]
    const rank = highRanks[Math.floor(Math.random() * highRanks.length)]
    const suits: Card["suit"][] = ["♠", "♥", "♦", "♣"]
    const suit = suits[Math.floor(Math.random() * suits.length)]
    return { card: { rank, suit }, remaining: deck, consumedForced: true }
  }
  const drawn = drawCard(deck)
  return { ...drawn, consumedForced: false }
}

/** Dealer draws to 17 (stands on all 17s), every hand still in gets scored, and win/push payouts are
 * computed - never applied here directly (this is called from inside a lobby transaction, which can
 * run more than once; crediting chips as a side effect of the callback itself would double-pay on a
 * retry). The caller applies `chipDeltas`/`potRefundTotal` for real, exactly once, after the
 * transaction actually commits - see runLobbyMutation. */
function resolveDealer(lobby: BlackjackLobby, forcedAvailable: boolean): { lobby: BlackjackLobby; chipDeltas: Record<string, number>; potRefundTotal: number; consumedForced: boolean } {
  let deck = lobby.deck
  let dealerHand = lobby.dealerHand
  lobby.dealerHidden = false
  let consumedForced = false

  const anyoneStillIn = lobby.playerOrder.some((id) => {
    const p = lobby.players[id]
    return !p.sittingOut && p.hands.some((h) => h.status !== "bust")
  })
  if (anyoneStillIn) {
    while (handValue(dealerHand) < 17) {
      const drawn = drawDealerCard(deck, dealerHand, forcedAvailable && !consumedForced)
      dealerHand = [...dealerHand, drawn.card]
      deck = drawn.remaining
      if (drawn.consumedForced) consumedForced = true
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

      const payout = Math.floor(lobby.buyIn * PAYOUT_MULTIPLIER[result])
      if (payout > 0) chipDeltas[id] = (chipDeltas[id] ?? 0) + payout
      if (result === "lose" && player.deathrollPotStake > 0) {
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
    consumedForced,
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
  testHands: Record<string, string | undefined>,
  forcedAvailable: boolean
): { lobby: BlackjackLobby; chipDeltas: Record<string, number>; potRefundTotal: number; consumedForced: boolean } {
  const buyIn = lobby.buyIn
  let deck = freshShuffledDeck()
  const chipDeltas: Record<string, number> = {}

  for (const id of lobby.playerOrder) {
    const balance = chips[id] ?? 0
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

  if (!allPlayersDone(lobby)) return { lobby, chipDeltas, potRefundTotal: 0, consumedForced: false }

  const resolved = resolveDealer(lobby, forcedAvailable)
  const mergedDeltas = { ...chipDeltas }
  for (const [id, delta] of Object.entries(resolved.chipDeltas)) mergedDeltas[id] = (mergedDeltas[id] ?? 0) + delta
  return { lobby: resolved.lobby, chipDeltas: mergedDeltas, potRefundTotal: resolved.potRefundTotal, consumedForced: resolved.consumedForced }
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
function maybeApplyRedealVote(lobby: BlackjackLobby): { lobby: BlackjackLobby; redealsConsumed: boolean } {
  if (!lobby.redealVote) return { lobby, redealsConsumed: false }
  const allYes = activeVoterIds(lobby).every((id) => lobby.redealVote!.votes[id])
  if (!allYes) return { lobby, redealsConsumed: false }
  return { lobby: performRedeal(lobby), redealsConsumed: true }
}

export async function requestBlackjackRedeal(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const available = dbUser.effects?.positive?.blackjackReDeals ?? 0

  let redealsConsumed = false
  const response = await runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    if (!lobby.players[user.id]) return { error: "Du er ikke ved dette bordet" }
    if (lobby.status !== "playing") return { error: "Kan bare brukes midt i en runde" }
    if (lobby.redealVote) return { error: "Det pågår allerede en avstemning om reshuffle" }
    if (lobby.redealDeniedFor?.includes(user.id)) {
      return { error: "Forespørselen din ble avvist denne runden - prøv igjen neste runde" }
    }
    if (available <= 0) return { error: 'Du har ingen "Deal på ny" igjen' }

    lobby.redealVote = { requestedBy: user.id, votes: { [user.id]: true }, createdAt: Date.now() }
    const resolved = maybeApplyRedealVote(lobby)
    redealsConsumed = resolved.redealsConsumed
    return { lobby: resolved.lobby }
  })

  if (redealsConsumed) await firebase.updateUserFields(user.id, { "effects/positive/blackjackReDeals": Math.max(0, available - 1) })
  return response
}

/** A single "no" cancels the vote outright - only unanimous "yes" ever triggers the redeal. */
export async function voteBlackjackRedeal(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser, approve: boolean) {
  const firebase = new FirebaseHelper()

  let redealsConsumed = false
  let requesterId: string | undefined
  const response = await runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
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
    return { lobby: resolved.lobby }
  })

  if (redealsConsumed && requesterId) {
    const dbUser = (await firebase.getUser(requesterId)) ?? {}
    await firebase.updateUserFields(requesterId, { "effects/positive/blackjackReDeals": Math.max(0, (dbUser.effects?.positive?.blackjackReDeals ?? 0) - 1) })
  }
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
  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const myChips = dbUser.chips ?? 0

  return runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    if (!lobby.players[user.id]) return { error: "Du er ikke ved dette bordet" }
    if (lobby.status === "playing") return { error: "Kan ikke endre satsing midt i en runde" }

    const proposedBuyIn = allIn ? myChips : Math.max(0, Math.floor(Number(buyInInput) || 0))
    if (proposedBuyIn === lobby.buyIn) return { lobby }

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
  if (!data) return Response.json({ buyIn: null })

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
  return Response.json({ pending: !!data })
}

export async function listBlackjackLobbies(instanceId: string, userId: string) {
  const firebase = new FirebaseHelper()
  const all = await readAllLobbies(firebase, instanceId)
  const lobbies = Object.values(all).map((l) => ({
    id: l.id,
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
  await leaveOtherLobbies(firebase, instanceId, user.id)

  // The client's buyInInput is only ever trusted for a genuinely manual "Start nytt bord" - if a
  // pending deathroll-pot auto-start flag actually exists server-side for this user, it (and whether
  // it's real pot money worth "tilbakelegg") always wins instead, consumed exactly once right here.
  // Never derive fromDeathrollPot from anything the client sent - that'd let anyone claim free
  // pot-loss refunds forever by just lying about it on an ordinary table.
  const pending = await firebase.getData(`other/pendingBlackjackAutoStart/${user.id}`)
  let buyIn = Math.max(0, Math.floor(Number(buyInInput) || 0))
  let fromDeathrollPot = false
  if (pending) {
    await firebase.updateData({ [`other/pendingBlackjackAutoStart/${user.id}`]: null })
    const pendingBuyIn = Math.max(0, Math.floor(Number(pending.buyIn) || 0))
    if (pendingBuyIn > 0) {
      buyIn = pendingBuyIn
      fromDeathrollPot = !!pending.fromDeathrollPot
    }
  }

  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const myChips = dbUser.chips ?? 0
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
      },
    },
    playerOrder: [user.id],
    spectators: {},
    dealerHand: [],
    dealerHidden: false,
    deck: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await writeLobby(firebase, instanceId, lobbyId, lobby)
  return Response.json(await publicView(firebase, lobby, user.id))
}

export async function joinBlackjackLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })

  if (!lobby.players[user.id]) {
    const dbUser = (await firebase.getUser(user.id)) ?? {}
    const myChips = dbUser.chips ?? 0
    if (myChips < lobby.buyIn) {
      return Response.json({ error: `Du har ikke nok chips til å bli med (du har ${myChips}, krever ${lobby.buyIn})` }, { status: 400 })
    }
    await leaveOtherLobbies(firebase, instanceId, user.id, lobbyId)
    if (lobby.spectators[user.id] !== undefined) delete lobby.spectators[user.id]
    lobby.players[user.id] = {
      id: user.id,
      username: user.globalName ?? user.username,
      avatar: user.avatar,
      sittingOut: false,
      hands: [],
      startingChips: myChips,
      hasPlayed: false,
      deathrollPotStake: 0,
    }
    lobby.playerOrder.push(user.id)
    await writeLobby(firebase, instanceId, lobbyId, lobby)
  }
  return Response.json(await publicView(firebase, lobby, user.id))
}

/** Watch a table without playing - no ante, no seat, no cards, just the same live view everyone
 * else gets. A seated player can't spectate their own table (leave first); a spectator who wants to
 * play instead should use joinBlackjackLobby, which already clears them out of spectators. */
export async function spectateBlackjackLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })
  if (lobby.players[user.id]) return Response.json({ error: "Du sitter allerede ved bordet" }, { status: 400 })

  if (lobby.spectators[user.id] === undefined) {
    await leaveOtherLobbies(firebase, instanceId, user.id, lobbyId)
    lobby.spectators[user.id] = { username: user.globalName ?? user.username, avatar: user.avatar }
    await writeLobby(firebase, instanceId, lobbyId, lobby)
  }
  return Response.json(await publicView(firebase, lobby, user.id))
}

/** Admin-only. Arms a guaranteed dealer bust for this table's next auto-resolve (drawDealerCard
 * picks whatever sequence of cards actually forces it, however many that takes - see there).
 * Available whether the admin is playing or just spectating, any time a round is live. Returns the
 * same plain view everyone else gets either way - nothing about this is visible anywhere, to anyone, ever. */
export async function forceBadDealerDraw(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  if (isAdminUser(user.id)) {
    await firebase.updateData({ [`other/pendingBlackjackForcedDealerCard/${instanceId}/${lobbyId}`]: true })
  }
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  return Response.json(await publicView(firebase, lobby, user.id))
}

export async function leaveBlackjackLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  await leaveLobby(firebase, instanceId, lobbyId, user.id)
  return Response.json({ ok: true })
}

export async function getBlackjackLobbyStatus(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true })
  return Response.json(await publicView(firebase, lobby, user.id))
}

/** Reads the admin "force bad draw" flag once, before the transaction that might consume it -
 * drawDealerCard/resolveDealer need it as a plain boolean since a transaction callback must be sync. */
async function peekForcedDealerCard(firebase: FirebaseHelper, instanceId: string, lobbyId: string): Promise<boolean> {
  return !!(await firebase.getData(`other/pendingBlackjackForcedDealerCard/${instanceId}/${lobbyId}`))
}

export async function dealBlackjackRound(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()

  // Everything performDeal/resolveDealer need that requires an async Firebase read has to be
  // resolved before the transaction - its own update callback must stay synchronous. There's a
  // small residual staleness window here (these balances/flags are a snapshot from just before the
  // transaction, not re-read on a retry) - acceptable since a retry only happens on genuine
  // contention on this exact lobby, and the alternative (the previous plain read-then-write) let
  // *every* concurrent request race, not just contended retries.
  const peek = await readLobby(firebase, instanceId, lobbyId)
  if (!peek) return Response.json({ closed: true }, { status: 404 })
  const forcedAvailable = await peekForcedDealerCard(firebase, instanceId, lobbyId)
  const chips: Record<string, number> = {}
  const testHands: Record<string, string | undefined> = {}
  for (const id of peek.playerOrder) {
    const dbUser = (await firebase.getUser(id)) ?? {}
    chips[id] = dbUser.chips ?? 0
    testHands[id] = (await firebase.getData(`other/pendingBlackjackTestHand/${id}`))?.rank
  }

  let consumedForced = false
  const response = await runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    if (!lobby.players[user.id]) return { error: "Du er ikke ved dette bordet" }
    if (lobby.status === "playing") return { error: "En runde pågår allerede" }
    if (lobby.status === "roundOver" && lobby.roundOverAt) {
      const remaining = ROUND_START_COOLDOWN_MS - (Date.now() - lobby.roundOverAt)
      if (remaining > 0) return { error: "Vent litt før neste runde", status: 429 }
    }
    const result = performDeal(lobby, chips, testHands, forcedAvailable)
    consumedForced = result.consumedForced
    return { lobby: result.lobby, chipDeltas: result.chipDeltas, potRefundTotal: result.potRefundTotal }
  })

  if (consumedForced) await firebase.updateData({ [`other/pendingBlackjackForcedDealerCard/${instanceId}/${lobbyId}`]: null })
  for (const id of Object.keys(testHands)) {
    if (testHands[id]) await firebase.updateData({ [`other/pendingBlackjackTestHand/${id}`]: null })
  }
  return response
}

export async function hitBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const forcedAvailable = await peekForcedDealerCard(firebase, instanceId, lobbyId)

  let consumedForced = false
  const response = await runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    const player = lobby.players[user.id]
    const handIndex = player ? activeHandIndex(player) : -1
    if (!player || lobby.status !== "playing" || handIndex === -1) {
      return { error: "Ikke din tur akkurat nå" }
    }

    const hand = player.hands[handIndex]
    const drawn = drawCard(lobby.deck)
    const cards = [...hand.cards, drawn.card]
    lobby.deck = drawn.remaining
    player.hands[handIndex] = { cards, status: handValue(cards) > 21 ? "bust" : "playing" }

    if (!allPlayersDone(lobby)) return { lobby }
    const resolved = resolveDealer(lobby, forcedAvailable)
    consumedForced = resolved.consumedForced
    return { lobby: resolved.lobby, chipDeltas: resolved.chipDeltas, potRefundTotal: resolved.potRefundTotal }
  })

  if (consumedForced) await firebase.updateData({ [`other/pendingBlackjackForcedDealerCard/${instanceId}/${lobbyId}`]: null })
  return response
}

export async function standBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const forcedAvailable = await peekForcedDealerCard(firebase, instanceId, lobbyId)

  let consumedForced = false
  const response = await runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    const player = lobby.players[user.id]
    const handIndex = player ? activeHandIndex(player) : -1
    if (!player || lobby.status !== "playing" || handIndex === -1) {
      return { error: "Ikke din tur akkurat nå" }
    }

    player.hands[handIndex] = { ...player.hands[handIndex], status: "stood" }

    if (!allPlayersDone(lobby)) return { lobby }
    const resolved = resolveDealer(lobby, forcedAvailable)
    consumedForced = resolved.consumedForced
    return { lobby: resolved.lobby, chipDeltas: resolved.chipDeltas, potRefundTotal: resolved.potRefundTotal }
  })

  if (consumedForced) await firebase.updateData({ [`other/pendingBlackjackForcedDealerCard/${instanceId}/${lobbyId}`]: null })
  return response
}

/** House rule: any two matching-rank cards can be split, including a hand that's already the
 * result of a split (drawing a third matching card lets you split again), as long as the buy-in
 * for the new hand is affordable. Each split hand is a fully separate bet from here on. */
export async function splitBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const forcedAvailable = await peekForcedDealerCard(firebase, instanceId, lobbyId)
  // Same residual-staleness note as dealBlackjackRound: a snapshot from just before the transaction,
  // re-used on a retry rather than re-read - only matters under genuine contention on this lobby.
  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const myChips = dbUser.chips ?? 0

  let consumedForced = false
  const response = await runLobbyMutation(firebase, instanceId, lobbyId, user.id, (lobby) => {
    const player = lobby.players[user.id]
    const handIndex = player ? activeHandIndex(player) : -1
    if (!player || lobby.status !== "playing" || handIndex === -1) {
      return { error: "Ikke din tur akkurat nå" }
    }

    const hand = player.hands[handIndex]
    if (hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank) {
      return { error: "Denne hånden kan ikke splittes" }
    }
    if (myChips < lobby.buyIn) {
      return { error: `Ikke nok chips til å splitte (du har ${myChips}, krever ${lobby.buyIn} til)` }
    }

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
    const resolved = resolveDealer(lobby, forcedAvailable)
    consumedForced = resolved.consumedForced
    const mergedDeltas = { ...chipDeltas }
    for (const [id, delta] of Object.entries(resolved.chipDeltas)) mergedDeltas[id] = (mergedDeltas[id] ?? 0) + delta
    return { lobby: resolved.lobby, chipDeltas: mergedDeltas, potRefundTotal: resolved.potRefundTotal }
  })

  if (consumedForced) await firebase.updateData({ [`other/pendingBlackjackForcedDealerCard/${instanceId}/${lobbyId}`]: null })
  return response
}
