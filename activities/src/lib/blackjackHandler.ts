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

interface BlackjackTable {
  status: TableStatus
  players: Record<string, BlackjackPlayer>
  playerOrder: string[]
  dealerHand: Card[]
  dealerHidden: boolean
  deck: Card[]
  /** Chips anted each round, set once by whoever hits "Start game". Undefined = game hasn't started yet. */
  buyIn?: number
  results?: Record<string, Result>
  updatedAt: number
}

// A win pays out the ante back plus even money (2x); blackjack pays 3:2 on top of the ante back
// (2.5x); a push just returns the ante (1x); a loss returns nothing (already deducted at deal time).
const PAYOUT_MULTIPLIER: Record<Result, number> = { win: 2, blackjack: 2.5, push: 1, lose: 0 }

const PATH_PREFIX = "multiplayerBlackjack"

function emptyTable(): BlackjackTable {
  return { status: "waiting", players: {}, playerOrder: [], dealerHand: [], dealerHidden: false, deck: [], updatedAt: Date.now() }
}

/** Firebase RTDB drops empty-array fields on write (no children = indistinguishable from "not
 * there"), so a table that's never had a round dealt can come back with `dealerHand`/`deck`
 * missing entirely, and a just-joined player with `hand` missing - normalize those back to `[]`. */
async function readTable(firebase: FirebaseHelper, instanceId: string): Promise<BlackjackTable> {
  const data = await firebase.getData(`other/${PATH_PREFIX}/${instanceId}`)
  if (!data) return emptyTable()

  const raw = data as BlackjackTable
  const players: Record<string, BlackjackPlayer> = {}
  for (const id of Object.keys(raw.players ?? {})) {
    players[id] = { ...raw.players[id], hand: raw.players[id].hand ?? [] }
  }

  return {
    status: raw.status ?? "waiting",
    players,
    playerOrder: raw.playerOrder ?? [],
    dealerHand: raw.dealerHand ?? [],
    dealerHidden: raw.dealerHidden ?? false,
    deck: raw.deck ?? [],
    // An object-literal key with value `undefined` is an own property (unlike a spread of a
    // missing key), and that's exactly what Firebase's write rejects - only include a key at all
    // when there's an actual value. Bit us twice already (results, then this same pattern again).
    ...(raw.results ? { results: raw.results } : {}),
    ...(raw.buyIn !== undefined ? { buyIn: raw.buyIn } : {}),
    updatedAt: raw.updatedAt ?? Date.now(),
  }
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
    buyIn: table.buyIn,
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

/** Dealer draws to 17 (stands on all 17s), every player still in gets scored, and win/push payouts
 * are credited immediately - a loss doesn't need a debit here, the ante was already taken at deal time. */
async function resolveDealer(firebase: FirebaseHelper, table: BlackjackTable): Promise<BlackjackTable> {
  let deck = table.deck
  let dealerHand = table.dealerHand
  table.dealerHidden = false

  const anyoneStillIn = table.playerOrder.some((id) => !["bust", "sittingOut"].includes(table.players[id].status))
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
  const buyIn = table.buyIn ?? 0

  const results: Record<string, Result> = {}
  for (const id of table.playerOrder) {
    const player = table.players[id]
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

    const payout = Math.floor(buyIn * PAYOUT_MULTIPLIER[result])
    if (payout > 0) {
      const dbUser = (await firebase.getUser(id)) ?? {}
      await firebase.updateUserFields(id, { chips: (dbUser.chips ?? 0) + payout })
    }
  }

  return { ...table, deck, dealerHand, status: "roundOver", results }
}

/** Charges every joined player the table's buy-in (skipping anyone who can't afford it - they sit
 * out this round rather than being removed from the table) and deals a fresh round. */
async function performDeal(firebase: FirebaseHelper, table: BlackjackTable): Promise<BlackjackTable> {
  const buyIn = table.buyIn ?? 0
  let deck = freshShuffledDeck()

  for (const id of table.playerOrder) {
    const dbUser = (await firebase.getUser(id)) ?? {}
    const chips = dbUser.chips ?? 0
    if (chips < buyIn) {
      table.players[id] = { ...table.players[id], hand: [], status: "sittingOut" }
      continue
    }
    if (buyIn > 0) await firebase.updateUserFields(id, { chips: chips - buyIn })

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
  delete table.results

  return allPlayersDone(table) ? await resolveDealer(firebase, table) : table
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
    if (table.buyIn !== undefined) {
      const dbUser = (await firebase.getUser(user.id)) ?? {}
      if ((dbUser.chips ?? 0) < table.buyIn) {
        return Response.json({ error: `Du har ikke nok chips til å bli med (krever ${table.buyIn})` }, { status: 400 })
      }
    }
    table.players[user.id] = { id: user.id, username: user.globalName ?? user.username, hand: [], status: "waiting" }
    table.playerOrder.push(user.id)
    await writeTable(firebase, instanceId, table)
  }
  return Response.json(publicView(table))
}

/** The one-time "Start game" action - sets the table's buy-in for every round that follows, then deals the first one. */
export async function startBlackjackGame(instanceId: string, user: AuthenticatedDiscordUser, buyInInput: unknown) {
  const firebase = new FirebaseHelper()
  const table = await readTable(firebase, instanceId)
  if (!table.players[user.id]) return Response.json({ error: "Bli med på bordet først" }, { status: 400 })
  if (table.buyIn !== undefined) return Response.json({ error: "Spillet er allerede startet" }, { status: 400 })
  if (table.playerOrder.length === 0) return Response.json({ error: "Ingen spillere ved bordet" }, { status: 400 })

  table.buyIn = Math.max(0, Math.floor(Number(buyInInput) || 0))
  const resolved = await performDeal(firebase, table)
  await writeTable(firebase, instanceId, resolved)
  return Response.json(publicView(resolved))
}

/** Every round after the first - reuses the buy-in "Start game" already locked in. */
export async function dealBlackjackRound(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const table = await readTable(firebase, instanceId)
  if (!table.players[user.id]) return Response.json({ error: "Bli med på bordet først" }, { status: 400 })
  if (table.buyIn === undefined) return Response.json({ error: "Spillet er ikke startet ennå" }, { status: 400 })
  if (table.status === "playing") return Response.json({ error: "En runde pågår allerede" }, { status: 400 })
  if (table.playerOrder.length === 0) return Response.json({ error: "Ingen spillere ved bordet" }, { status: 400 })

  const resolved = await performDeal(firebase, table)
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

  const resolved = allPlayersDone(table) ? await resolveDealer(firebase, table) : table
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
  const resolved = allPlayersDone(table) ? await resolveDealer(firebase, table) : table
  await writeTable(firebase, instanceId, resolved)
  return Response.json(publicView(resolved))
}
