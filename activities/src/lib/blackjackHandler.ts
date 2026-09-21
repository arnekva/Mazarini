import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { Card, drawCard, freshShuffledDeck, handValue, isBlackjack } from "./blackjack"

type PlayerStatus = "waiting" | "playing" | "stood" | "bust" | "blackjack" | "sittingOut"
type TableStatus = "waiting" | "playing" | "roundOver"
type Result = "win" | "lose" | "push" | "blackjack"

interface BlackjackPlayer {
  id: string
  username: string
  hand: Card[]
  status: PlayerStatus
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
  results?: Record<string, Result>
  createdAt: number
  updatedAt: number
}

// A win pays out the ante back plus even money (2x); blackjack pays 3:2 on top of the ante back
// (2.5x); a push just returns the ante (1x); a loss returns nothing (already deducted at deal time).
const PAYOUT_MULTIPLIER: Record<Result, number> = { win: 2, blackjack: 2.5, push: 1, lose: 0 }

// One voice channel (instanceId) can host several concurrent lobbies - other/multiplayerBlackjack/{instanceId}/{lobbyId}.
const PATH_PREFIX = "multiplayerBlackjack"

/** Firebase RTDB drops empty-array fields on write (no children = indistinguishable from "not
 * there"), so a lobby that's never had a round dealt can come back with `dealerHand`/`deck`
 * missing entirely, and a just-joined player with `hand` missing - normalize those back to `[]`.
 * Also: never spread a key whose value is `undefined` (e.g. `results`) back into a write - Firebase
 * rejects that outright, which is why this reads back only real values for optional fields. */
function normalizeLobby(raw: any): BlackjackLobby {
  const players: Record<string, BlackjackPlayer> = {}
  for (const id of Object.keys(raw.players ?? {})) {
    players[id] = { ...raw.players[id], hand: raw.players[id].hand ?? [] }
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
async function publicView(firebase: FirebaseHelper, lobby: BlackjackLobby, userId: string) {
  const dealerHand = lobby.dealerHidden ? [lobby.dealerHand[0], { rank: "?", suit: "?" as const }] : lobby.dealerHand
  const dbUser = (await firebase.getUser(userId)) ?? {}
  return {
    id: lobby.id,
    hostId: lobby.hostId,
    status: lobby.status,
    buyIn: lobby.buyIn,
    myChips: dbUser.chips ?? 0,
    players: lobby.playerOrder.map((id) => {
      const p = lobby.players[id]
      return { id: p.id, username: p.username, hand: p.hand, status: p.status, value: handValue(p.hand) }
    }),
    dealer: { hand: dealerHand, value: lobby.dealerHidden ? undefined : handValue(lobby.dealerHand) },
    results: lobby.results,
  }
}

function allPlayersDone(lobby: BlackjackLobby): boolean {
  return lobby.playerOrder.every((id) => lobby.players[id].status !== "playing")
}

/** Dealer draws to 17 (stands on all 17s), every player still in gets scored, and win/push payouts
 * are credited immediately - a loss doesn't need a debit here, the ante was already taken at deal time. */
async function resolveDealer(firebase: FirebaseHelper, lobby: BlackjackLobby): Promise<BlackjackLobby> {
  let deck = lobby.deck
  let dealerHand = lobby.dealerHand
  lobby.dealerHidden = false

  const anyoneStillIn = lobby.playerOrder.some((id) => !["bust", "sittingOut"].includes(lobby.players[id].status))
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

  const results: Record<string, Result> = {}
  for (const id of lobby.playerOrder) {
    const player = lobby.players[id]
    if (player.status === "sittingOut") continue // didn't ante this round, nothing to score

    let result: Result
    if (player.status === "bust") result = "lose"
    else if (player.status === "blackjack") result = dealerBlackjack ? "push" : "blackjack"
    else if (dealerBust) result = "win"
    else {
      const playerTotal = handValue(player.hand)
      result = playerTotal > dealerTotal ? "win" : playerTotal < dealerTotal ? "lose" : "push"
    }
    results[id] = result

    const payout = Math.floor(lobby.buyIn * PAYOUT_MULTIPLIER[result])
    if (payout > 0) {
      const dbUser = (await firebase.getUser(id)) ?? {}
      await firebase.updateUserFields(id, { chips: (dbUser.chips ?? 0) + payout })
    }
  }

  return { ...lobby, deck, dealerHand, status: "roundOver", results }
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
      lobby.players[id] = { ...lobby.players[id], hand: [], status: "sittingOut" }
      continue
    }
    if (buyIn > 0) await firebase.updateUserFields(id, { chips: chips - buyIn })

    const first = drawCard(deck)
    const second = drawCard(first.remaining)
    const hand = [first.card, second.card]
    lobby.players[id] = { ...lobby.players[id], hand, status: isBlackjack(hand) ? "blackjack" : "playing" }
    deck = second.remaining
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
    players: { [user.id]: { id: user.id, username, hand: [], status: "waiting" } },
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
    lobby.players[user.id] = { id: user.id, username: user.globalName ?? user.username, hand: [], status: "waiting" }
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
  if (!player || lobby.status !== "playing" || player.status !== "playing") {
    return Response.json({ error: "Ikke din tur akkurat nå" }, { status: 400 })
  }

  const drawn = drawCard(lobby.deck)
  const hand = [...player.hand, drawn.card]
  lobby.deck = drawn.remaining
  lobby.players[user.id] = { ...player, hand, status: handValue(hand) > 21 ? "bust" : "playing" }

  const resolved = allPlayersDone(lobby) ? await resolveDealer(firebase, lobby) : lobby
  await writeLobby(firebase, instanceId, lobbyId, resolved)
  return Response.json(await publicView(firebase, resolved, user.id))
}

export async function standBlackjack(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  const player = lobby.players[user.id]
  if (!player || lobby.status !== "playing" || player.status !== "playing") {
    return Response.json({ error: "Ikke din tur akkurat nå" }, { status: 400 })
  }

  lobby.players[user.id] = { ...player, status: "stood" }
  const resolved = allPlayersDone(lobby) ? await resolveDealer(firebase, lobby) : lobby
  await writeLobby(firebase, instanceId, lobbyId, resolved)
  return Response.json(await publicView(firebase, resolved, user.id))
}
