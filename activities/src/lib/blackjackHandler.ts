import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { Card, drawCard, freshShuffledDeck, handValue, isBlackjack } from "./blackjack"

type PlayerStatus = "waiting" | "playing" | "stood" | "bust" | "blackjack"
type TableStatus = "waiting" | "playing" | "roundOver"
type Result = "win" | "lose" | "push" | "blackjack"

interface BlackjackPlayer {
  id: string
  username: string
  hand: Card[]
  status: PlayerStatus
}

interface BlackjackTable {
  status: TableStatus
  players: Record<string, BlackjackPlayer>
  playerOrder: string[]
  dealerHand: Card[]
  dealerHidden: boolean
  deck: Card[]
  results?: Record<string, Result>
  updatedAt: number
}

// No chip staking for v1 - this is just the shared table/turn logic, wagering can layer on once
// the core multiplayer loop (join/deal/hit/stand/resolve) has actually been played and feels right.
const PATH_PREFIX = "multiplayerBlackjack"

function emptyTable(): BlackjackTable {
  return { status: "waiting", players: {}, playerOrder: [], dealerHand: [], dealerHidden: false, deck: [], updatedAt: Date.now() }
}

async function readTable(firebase: FirebaseHelper, instanceId: string): Promise<BlackjackTable> {
  const data = await firebase.getData(`other/${PATH_PREFIX}/${instanceId}`)
  return (data as BlackjackTable) ?? emptyTable()
}

async function writeTable(firebase: FirebaseHelper, instanceId: string, table: BlackjackTable) {
  await firebase.updateData({ [`other/${PATH_PREFIX}/${instanceId}`]: { ...table, updatedAt: Date.now() } })
}

/** What every player sees - identical for everyone except the dealer's hole card, which is hidden
 * (real cards, just not sent to the client) while a round is in progress. */
function publicView(table: BlackjackTable) {
  const dealerHand = table.dealerHidden ? [table.dealerHand[0], { rank: "?", suit: "?" as const }] : table.dealerHand
  return {
    status: table.status,
    players: table.playerOrder.map((id) => {
      const p = table.players[id]
      return { id: p.id, username: p.username, hand: p.hand, status: p.status, value: handValue(p.hand) }
    }),
    dealer: { hand: dealerHand, value: table.dealerHidden ? undefined : handValue(table.dealerHand) },
    results: table.results,
  }
}

function allPlayersDone(table: BlackjackTable): boolean {
  return table.playerOrder.every((id) => table.players[id].status !== "playing")
}

/** Dealer draws to 17 (stands on all 17s) and every non-bust player is scored against the final total. */
function resolveDealer(table: BlackjackTable): BlackjackTable {
  let deck = table.deck
  let dealerHand = table.dealerHand
  table.dealerHidden = false

  const anyoneStillIn = table.playerOrder.some((id) => table.players[id].status !== "bust")
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
  for (const id of table.playerOrder) {
    const player = table.players[id]
    if (player.status === "bust") {
      results[id] = "lose"
    } else if (player.status === "blackjack") {
      results[id] = dealerBlackjack ? "push" : "blackjack"
    } else if (dealerBust) {
      results[id] = "win"
    } else {
      const playerTotal = handValue(player.hand)
      results[id] = playerTotal > dealerTotal ? "win" : playerTotal < dealerTotal ? "lose" : "push"
    }
  }

  return { ...table, deck, dealerHand, status: "roundOver", results }
}

export async function getBlackjackStatus(instanceId: string) {
  const firebase = new FirebaseHelper()
  const table = await readTable(firebase, instanceId)
  return Response.json(publicView(table))
}

export async function joinBlackjackTable(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const table = await readTable(firebase, instanceId)

  if (!table.players[user.id]) {
    table.players[user.id] = { id: user.id, username: user.globalName ?? user.username, hand: [], status: "waiting" }
    table.playerOrder.push(user.id)
    await writeTable(firebase, instanceId, table)
  }
  return Response.json(publicView(table))
}

export async function dealBlackjackRound(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const table = await readTable(firebase, instanceId)
  if (!table.players[user.id]) return Response.json({ error: "Bli med på bordet først" }, { status: 400 })
  if (table.status === "playing") return Response.json({ error: "En runde pågår allerede" }, { status: 400 })
  if (table.playerOrder.length === 0) return Response.json({ error: "Ingen spillere ved bordet" }, { status: 400 })

  let deck = freshShuffledDeck()
  for (const id of table.playerOrder) {
    const first = drawCard(deck)
    const second = drawCard(first.remaining)
    const hand = [first.card, second.card]
    table.players[id] = { ...table.players[id], hand, status: isBlackjack(hand) ? "blackjack" : "playing" }
    deck = second.remaining
  }
  const dealerFirst = drawCard(deck)
  const dealerSecond = drawCard(dealerFirst.remaining)
  table.dealerHand = [dealerFirst.card, dealerSecond.card]
  table.deck = dealerSecond.remaining
  table.dealerHidden = true
  table.status = "playing"
  table.results = undefined

  const resolved = allPlayersDone(table) ? resolveDealer(table) : table
  await writeTable(firebase, instanceId, resolved)
  return Response.json(publicView(resolved))
}

export async function hitBlackjack(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const table = await readTable(firebase, instanceId)
  const player = table.players[user.id]
  if (!player || table.status !== "playing" || player.status !== "playing") {
    return Response.json({ error: "Ikke din tur akkurat nå" }, { status: 400 })
  }

  const drawn = drawCard(table.deck)
  const hand = [...player.hand, drawn.card]
  table.deck = drawn.remaining
  table.players[user.id] = { ...player, hand, status: handValue(hand) > 21 ? "bust" : "playing" }

  const resolved = allPlayersDone(table) ? resolveDealer(table) : table
  await writeTable(firebase, instanceId, resolved)
  return Response.json(publicView(resolved))
}

export async function standBlackjack(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const table = await readTable(firebase, instanceId)
  const player = table.players[user.id]
  if (!player || table.status !== "playing" || player.status !== "playing") {
    return Response.json({ error: "Ikke din tur akkurat nå" }, { status: 400 })
  }

  table.players[user.id] = { ...player, status: "stood" }
  const resolved = allPlayersDone(table) ? resolveDealer(table) : table
  await writeTable(firebase, instanceId, resolved)
  return Response.json(publicView(resolved))
}
