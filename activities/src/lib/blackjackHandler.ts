import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { Card, drawCard, freshShuffledDeck, handValue, isBlackjack } from "./blackjack"

type HandStatus = "playing" | "stood" | "bust" | "blackjack"
type TableStatus = "waiting" | "playing" | "roundOver"
type Result = "win" | "lose" | "push" | "blackjack"

interface PlayerHand {
  cards: Card[]
  status: HandStatus
}

interface BlackjackPlayer {
  id: string
  username: string
  sittingOut: boolean
  /** Normally one hand - more than one once you've split. Acted on left-to-right: the first hand
   * still `playing` is the one Hit/Stand/Split apply to. */
  hands: PlayerHand[]
}

interface RedealVote {
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
  dealerHand: Card[]
  dealerHidden: boolean
  deck: Card[]
  /** One result per hand, in the same order as that player's `hands`. */
  results?: Record<string, Result[]>
  /** An in-progress "Deal på ny" vote - needs a yes from every active (non-sitting-out) player. */
  redealVote?: RedealVote
  createdAt: number
  updatedAt: number
}

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
    players[id] = { id: p.id, username: p.username, sittingOut: p.sittingOut ?? false, hands: (p.hands ?? []).map((h: any) => ({ cards: h.cards ?? [], status: h.status })) }
  }
  return {
    id: raw.id,
    hostId: raw.hostId,
    buyIn: raw.buyIn ?? 0,
    status: raw.status ?? "waiting",
    players,
    playerOrder: raw.playerOrder ?? [],
    dealerHand: raw.dealerHand ?? [],
    dealerHidden: raw.dealerHidden ?? false,
    deck: raw.deck ?? [],
    ...(raw.results ? { results: raw.results } : {}),
    ...(raw.redealVote ? { redealVote: raw.redealVote } : {}),
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

/** The host leaving closes the table for everyone (deleted outright); anyone else leaving just
 * frees their seat. A lobby that ends up with no one left in it is cleaned up either way. */
async function leaveLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string, userId: string) {
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby || !lobby.players[userId]) return

  if (lobby.hostId === userId) {
    await deleteLobby(firebase, instanceId, lobbyId)
    return
  }
  const playerOrder = lobby.playerOrder.filter((id) => id !== userId)
  if (playerOrder.length === 0) {
    await deleteLobby(firebase, instanceId, lobbyId)
    return
  }
  const players = { ...lobby.players }
  delete players[userId]
  await writeLobby(firebase, instanceId, lobbyId, { ...lobby, players, playerOrder })
}

/** You can only ever be seated at one lobby per voice channel - switching lobbies (or creating a
 * new one) quietly leaves whichever one you were previously in. */
async function leaveOtherLobbies(firebase: FirebaseHelper, instanceId: string, userId: string, exceptLobbyId?: string) {
  const all = await readAllLobbies(firebase, instanceId)
  for (const lobbyId of Object.keys(all)) {
    if (lobbyId === exceptLobbyId) continue
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
    players: lobby.playerOrder.map((id) => {
      const p = lobby.players[id]
      return {
        id: p.id,
        username: p.username,
        sittingOut: p.sittingOut,
        hands: p.hands.map((h) => ({ cards: h.cards, status: h.status, value: handValue(h.cards) })),
      }
    }),
    dealer: { hand: dealerHand, value: lobby.dealerHidden ? undefined : handValue(lobby.dealerHand) },
    results: lobby.results,
    redealVote: lobby.redealVote
      ? {
          requestedBy: lobby.redealVote.requestedBy,
          requestedByUsername: lobby.players[lobby.redealVote.requestedBy]?.username ?? "?",
          yesCount: Object.keys(lobby.redealVote.votes).length,
          totalNeeded: activeVoterIds(lobby).length,
          myVoted: !!lobby.redealVote.votes[userId],
        }
      : undefined,
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

/** Dealer draws to 17 (stands on all 17s), every hand still in gets scored, and win/push payouts
 * are credited immediately - a loss doesn't need a debit here, the ante was already taken at deal/split time. */
async function resolveDealer(firebase: FirebaseHelper, lobby: BlackjackLobby): Promise<BlackjackLobby> {
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
      if (payout > 0) {
        const dbUser = (await firebase.getUser(id)) ?? {}
        await firebase.updateUserFields(id, { chips: (dbUser.chips ?? 0) + payout })
      }
    }
    results[id] = handResults
  }

  return { ...lobby, deck, dealerHand, status: "roundOver", results }
}

/** Test-only hook (see TestCommands' /test in the bot repo): forces a player's next opening hand to
 * a specific rank pair instead of a real draw, so split can be tested without waiting for a natural
 * pair. Set at other/pendingBlackjackTestHand/{userId} and consumed (deleted) the moment it's dealt. */
async function drawOpeningHand(firebase: FirebaseHelper, playerId: string, deck: Card[]): Promise<{ hand: Card[]; remaining: Card[] }> {
  const forcedRank = await firebase.getData(`other/pendingBlackjackTestHand/${playerId}`)
  if (forcedRank?.rank) {
    await firebase.updateData({ [`other/pendingBlackjackTestHand/${playerId}`]: null })
    const suits: Card["suit"][] = ["♠", "♥"]
    return { hand: [{ rank: forcedRank.rank, suit: suits[0] }, { rank: forcedRank.rank, suit: suits[1] }], remaining: deck }
  }
  const first = drawCard(deck)
  const second = drawCard(first.remaining)
  return { hand: [first.card, second.card], remaining: second.remaining }
}

/** Charges every seated player the lobby's buy-in (skipping anyone who can't afford it - they sit
 * out this round rather than being removed from the table) and deals a fresh round. */
async function performDeal(firebase: FirebaseHelper, lobby: BlackjackLobby): Promise<BlackjackLobby> {
  const buyIn = lobby.buyIn
  let deck = freshShuffledDeck()

  for (const id of lobby.playerOrder) {
    const dbUser = (await firebase.getUser(id)) ?? {}
    const chips = dbUser.chips ?? 0
    if (chips < buyIn) {
      lobby.players[id] = { ...lobby.players[id], sittingOut: true, hands: [] }
      continue
    }
    if (buyIn > 0) await firebase.updateUserFields(id, { chips: chips - buyIn })

    const cards = await drawOpeningHand(firebase, id, deck)
    deck = cards.remaining
    lobby.players[id] = { ...lobby.players[id], sittingOut: false, hands: [{ cards: cards.hand, status: isBlackjack(cards.hand) ? "blackjack" : "playing" }] }
  }

  const dealerFirst = drawCard(deck)
  const dealerSecond = drawCard(dealerFirst.remaining)
  lobby.dealerHand = [dealerFirst.card, dealerSecond.card]
  lobby.deck = dealerSecond.remaining
  lobby.dealerHidden = true
  lobby.status = "playing"
  delete lobby.results

  return allPlayersDone(lobby) ? await resolveDealer(firebase, lobby) : lobby
}

/** Reshuffles a fresh two cards for every active player (collapsing any splits) - no new antes,
 * it's a free do-over of the hands already dealt, not a new round. Sitting-out players stay out. */
async function performRedeal(lobby: BlackjackLobby): Promise<BlackjackLobby> {
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

  return lobby
}

/** If every active player has now voted yes, consumes the requester's "Deal på ny" and redeals -
 * otherwise leaves the vote pending. Returns the lobby unchanged either way if there's no vote. */
async function maybeApplyRedealVote(firebase: FirebaseHelper, lobby: BlackjackLobby): Promise<BlackjackLobby> {
  if (!lobby.redealVote) return lobby
  const allYes = activeVoterIds(lobby).every((id) => lobby.redealVote!.votes[id])
  if (!allYes) return lobby

  const requesterId = lobby.redealVote.requestedBy
  const dbUser = (await firebase.getUser(requesterId)) ?? {}
  const remaining = Math.max(0, (dbUser.effects?.positive?.blackjackReDeals ?? 0) - 1)
  await firebase.updateUserFields(requesterId, { "effects/positive/blackjackReDeals": remaining })

  return await performRedeal(lobby)
}

export async function requestBlackjackRedeal(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  if (!lobby.players[user.id]) return Response.json({ error: "Du er ikke ved dette bordet" }, { status: 400 })
  if (lobby.status !== "playing") return Response.json({ error: "Kan bare brukes midt i en runde" }, { status: 400 })
  if (lobby.redealVote) return Response.json({ error: "Det pågår allerede en avstemning om reshuffle" }, { status: 400 })

  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const available = dbUser.effects?.positive?.blackjackReDeals ?? 0
  if (available <= 0) return Response.json({ error: 'Du har ingen "Deal på ny" igjen' }, { status: 400 })

  lobby.redealVote = { requestedBy: user.id, votes: { [user.id]: true }, createdAt: Date.now() }
  const resolved = await maybeApplyRedealVote(firebase, lobby)
  await writeLobby(firebase, instanceId, lobbyId, resolved)
  return Response.json(await publicView(firebase, resolved, user.id))
}

/** A single "no" cancels the vote outright - only unanimous "yes" ever triggers the redeal. */
export async function voteBlackjackRedeal(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser, approve: boolean) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  if (!lobby.players[user.id]) return Response.json({ error: "Du er ikke ved dette bordet" }, { status: 400 })
  if (!lobby.redealVote) return Response.json({ error: "Ingen aktiv avstemning" }, { status: 400 })

  if (!approve) {
    delete lobby.redealVote
    await writeLobby(firebase, instanceId, lobbyId, lobby)
    return Response.json(await publicView(firebase, lobby, user.id))
  }

  lobby.redealVote.votes[user.id] = true
  const resolved = await maybeApplyRedealVote(firebase, lobby)
  await writeLobby(firebase, instanceId, lobbyId, resolved)
  return Response.json(await publicView(firebase, resolved, user.id))
}

/** The bot writes here (other/pendingBlackjackAutoStart/{userId}) when the "Spill Blackjack" button
 * on a /terning pot win is clicked, so the winner's Activity session auto-creates a lobby with the
 * pot as buy-in instead of landing on the plain lobby list. Consumed once (deleted on read). */
export async function consumePendingBlackjackAutoStart(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const data = await firebase.getData(`other/pendingBlackjackAutoStart/${user.id}`)
  if (!data) return Response.json({ buyIn: null })
  await firebase.updateData({ [`other/pendingBlackjackAutoStart/${user.id}`]: null })
  return Response.json({ buyIn: Math.max(0, Math.floor(Number(data.buyIn) || 0)) })
}

export async function listBlackjackLobbies(instanceId: string, userId: string) {
  const firebase = new FirebaseHelper()
  const all = await readAllLobbies(firebase, instanceId)
  const lobbies = Object.values(all).map((l) => ({
    id: l.id,
    hostUsername: l.players[l.hostId]?.username ?? "?",
    buyIn: l.buyIn,
    numPlayers: l.playerOrder.length,
    status: l.status,
  }))
  const myLobbyId = Object.values(all).find((l) => l.players[userId])?.id ?? null
  return Response.json({ lobbies, myLobbyId })
}

export async function createBlackjackLobby(instanceId: string, user: AuthenticatedDiscordUser, buyInInput: unknown) {
  const firebase = new FirebaseHelper()
  await leaveOtherLobbies(firebase, instanceId, user.id)

  const buyIn = Math.max(0, Math.floor(Number(buyInInput) || 0))
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
    players: { [user.id]: { id: user.id, username, sittingOut: false, hands: [] } },
    playerOrder: [user.id],
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
    lobby.players[user.id] = { id: user.id, username: user.globalName ?? user.username, sittingOut: false, hands: [] }
    lobby.playerOrder.push(user.id)
    await writeLobby(firebase, instanceId, lobbyId, lobby)
  }
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

export async function dealBlackjackRound(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  if (!lobby.players[user.id]) return Response.json({ error: "Du er ikke ved dette bordet" }, { status: 400 })
  if (lobby.status === "playing") return Response.json({ error: "En runde pågår allerede" }, { status: 400 })

  const resolved = await performDeal(firebase, lobby)
  await writeLobby(firebase, instanceId, lobbyId, resolved)
  return Response.json(await publicView(firebase, resolved, user.id))
}

export async function hitBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  const player = lobby.players[user.id]
  const handIndex = player ? activeHandIndex(player) : -1
  if (!player || lobby.status !== "playing" || handIndex === -1) {
    return Response.json({ error: "Ikke din tur akkurat nå" }, { status: 400 })
  }

  const hand = player.hands[handIndex]
  const drawn = drawCard(lobby.deck)
  const cards = [...hand.cards, drawn.card]
  lobby.deck = drawn.remaining
  player.hands[handIndex] = { cards, status: handValue(cards) > 21 ? "bust" : "playing" }

  const resolved = allPlayersDone(lobby) ? await resolveDealer(firebase, lobby) : lobby
  await writeLobby(firebase, instanceId, lobbyId, resolved)
  return Response.json(await publicView(firebase, resolved, user.id))
}

export async function standBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  const player = lobby.players[user.id]
  const handIndex = player ? activeHandIndex(player) : -1
  if (!player || lobby.status !== "playing" || handIndex === -1) {
    return Response.json({ error: "Ikke din tur akkurat nå" }, { status: 400 })
  }

  player.hands[handIndex] = { ...player.hands[handIndex], status: "stood" }
  const resolved = allPlayersDone(lobby) ? await resolveDealer(firebase, lobby) : lobby
  await writeLobby(firebase, instanceId, lobbyId, resolved)
  return Response.json(await publicView(firebase, resolved, user.id))
}

/** House rule: any two matching-rank cards can be split, including a hand that's already the
 * result of a split (drawing a third matching card lets you split again), as long as the buy-in
 * for the new hand is affordable. Each split hand is a fully separate bet from here on. */
export async function splitBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  const player = lobby.players[user.id]
  const handIndex = player ? activeHandIndex(player) : -1
  if (!player || lobby.status !== "playing" || handIndex === -1) {
    return Response.json({ error: "Ikke din tur akkurat nå" }, { status: 400 })
  }

  const hand = player.hands[handIndex]
  if (hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank) {
    return Response.json({ error: "Denne hånden kan ikke splittes" }, { status: 400 })
  }

  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const myChips = dbUser.chips ?? 0
  if (myChips < lobby.buyIn) {
    return Response.json({ error: `Ikke nok chips til å splitte (du har ${myChips}, krever ${lobby.buyIn} til)` }, { status: 400 })
  }
  if (lobby.buyIn > 0) await firebase.updateUserFields(user.id, { chips: myChips - lobby.buyIn })

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

  const resolved = allPlayersDone(lobby) ? await resolveDealer(firebase, lobby) : lobby
  await writeLobby(firebase, instanceId, lobbyId, resolved)
  return Response.json(await publicView(firebase, resolved, user.id))
}
