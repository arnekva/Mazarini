import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { Card, drawCard, freshShuffledDeck } from "./blackjack"
import { discordAvatarUrl } from "./discordAvatar"

// Port of the bot's /redblack (commands/drinks/redBlack) - three phases:
//   1. "rb"  - four guessing rounds, everyone takes a turn per round, drawing a card into their hand each time
//   2. "gt"  - Give/Take pyramid: cards are flipped one by one, players can lay a same-rank card on it
//   3. "bus" - whoever has the most cards left (ties: highest total) rides the bus alone

type Phase = "waiting" | "rb" | "gt" | "bus" | "finished"
type RbRound = "RB" | "UD" | "IO" | "SUIT" | "DONE"
type Lane = 0 | 1 | 2 | 3 // give | take | give+take | chug

/** Sips at stake per phase-1 round. Correct guess = give this many away, wrong = drink them. */
const RB_ROUND_SIPS: Record<Exclude<RbRound, "DONE">, number> = { RB: 1, UD: 2, IO: 3, SUIT: 4 }
const RB_ORDER: RbRound[] = ["RB", "UD", "IO", "SUIT", "DONE"]

const GT_ROWS = 4
/** Sips per row = row number * this (row 1 is flipped first). */
const GT_SIPS_PER_ROW = 1
/** Time before the next pyramid card can be flipped - stops spam-flipping before anyone can lay a card. */
const GT_FLIP_COOLDOWN_MS = 5000

const BUS_LENGTH = 7 // start card + 6 to guess

interface RbPlayer {
  id: string
  username: string
  avatar: string | null
  cards: Card[]
}

interface Spectator {
  username: string
  avatar: string | null
}

interface GtCard {
  card: Card
  lane: Lane
  row: number
  revealed: boolean
}

interface GtPlacement {
  playerId: string
  username: string
  card: Card
}

interface GtState {
  cards: GtCard[]
  /** Index of the next card to flip - the card currently in play is nextIndex - 1. */
  nextIndex: number
  flippedAt: number
  placements: GtPlacement[]
}

interface BusCard {
  card: Card
  revealed: boolean
}

interface BusState {
  stage: "pickLoser" | "riding" | "done"
  candidates: string[]
  loserId?: string
  cards: BusCard[]
  nextIndex: number
  totalSips: number
  awaitingRetry: boolean
  last?: { guess: string; correct: boolean; sips: number }
}

interface LastGuess {
  playerId: string
  username: string
  round: Exclude<RbRound, "DONE">
  guess: string
  card: Card
  correct: boolean
  sips: number
}

interface RedBlackLobby {
  id: string
  hostId: string
  phase: Phase
  rbRound: RbRound
  players: Record<string, RbPlayer>
  playerOrder: string[]
  spectators: Record<string, Spectator>
  deck: Card[]
  /** Fixed value for every ace once decided (see rigAce) - undefined means "not decided yet", played as 14. */
  aceValue?: 1 | 14
  turnIndex: number
  last?: LastGuess
  gt?: GtState
  bus?: BusState
  createdAt: number
  updatedAt: number
}

const PATH_PREFIX = "multiplayerRedBlack"

/** Firebase RTDB drops empty arrays (a player with no cards yet, an empty placements log), so those
 * come back missing and are normalized back to `[]` here. */
function normalizeLobby(raw: any): RedBlackLobby {
  const players: Record<string, RbPlayer> = {}
  for (const id of Object.keys(raw.players ?? {})) {
    const p = raw.players[id]
    players[id] = { id: p.id, username: p.username, avatar: p.avatar ?? null, cards: p.cards ?? [] }
  }
  const spectators: Record<string, Spectator> = {}
  for (const id of Object.keys(raw.spectators ?? {})) {
    spectators[id] = { username: raw.spectators[id].username, avatar: raw.spectators[id].avatar ?? null }
  }
  return {
    ...raw,
    phase: raw.phase ?? "waiting",
    rbRound: raw.rbRound ?? "RB",
    players,
    playerOrder: raw.playerOrder ?? [],
    spectators,
    deck: raw.deck ?? [],
    turnIndex: raw.turnIndex ?? 0,
    gt: raw.gt ? { ...raw.gt, cards: raw.gt.cards ?? [], placements: raw.gt.placements ?? [] } : undefined,
    bus: raw.bus ? { ...raw.bus, candidates: raw.bus.candidates ?? [], cards: raw.bus.cards ?? [], awaitingRetry: raw.bus.awaitingRetry ?? false } : undefined,
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? Date.now(),
  }
}

const lobbyPath = (instanceId: string, lobbyId: string) => `other/${PATH_PREFIX}/${instanceId}/${lobbyId}`

/** A lobby as it's stored, stamped with the time of this write - which doubles as its version: every view carries it, and clients
 * compare it with the one in the database to know whether they're behind (see lib/liveSignal.ts). The JSON round-trip strips
 * `undefined` fields, which Firebase rejects outright. */
function forDb(lobby: RedBlackLobby) {
  lobby.updatedAt = Date.now()
  return JSON.parse(JSON.stringify(lobby))
}

/** There's no heartbeat at these tables, so one that everybody just walked away from stays behind. A lobby nobody has touched
 * for this long is cleared out the next time someone looks at the list. */
const STALE_LOBBY_MS = 6 * 60 * 60 * 1000

async function readLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string): Promise<RedBlackLobby | null> {
  const data = await firebase.getData(lobbyPath(instanceId, lobbyId))
  return data ? normalizeLobby({ id: lobbyId, ...data }) : null
}

async function readAllLobbies(firebase: FirebaseHelper, instanceId: string): Promise<Record<string, RedBlackLobby>> {
  const data = (await firebase.getData(`other/${PATH_PREFIX}/${instanceId}`)) ?? {}
  const result: Record<string, RedBlackLobby> = {}
  const stale: Record<string, null> = {}
  for (const lobbyId of Object.keys(data)) {
    if (Date.now() - (data[lobbyId].updatedAt ?? 0) > STALE_LOBBY_MS) stale[lobbyPath(instanceId, lobbyId)] = null
    else result[lobbyId] = normalizeLobby({ id: lobbyId, ...data[lobbyId] })
  }
  if (Object.keys(stale).length > 0) await firebase.updateData(stale)
  return result
}

async function writeLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string, lobby: RedBlackLobby) {
  await firebase.updateData({ [lobbyPath(instanceId, lobbyId)]: forDb(lobby) })
}

/** Every change to an existing lobby goes through here: an atomic read-modify-write (see FirebaseHelper.transact), so two requests
 * landing together can't overwrite each other. `apply` changes the lobby in place, or returns a message to reject the change instead.
 * It can run more than once. Resolves to the lobby as it is afterwards - null if it's gone. */
async function updateLobby(
  firebase: FirebaseHelper,
  instanceId: string,
  lobbyId: string,
  apply: (lobby: RedBlackLobby) => string | void
): Promise<{ lobby: RedBlackLobby | null; error?: string }> {
  const box: { error?: string } = {}
  const raw = await firebase.transact<any>(lobbyPath(instanceId, lobbyId), (current) => {
    const lobby = normalizeLobby({ id: lobbyId, ...current })
    box.error = apply(lobby) || undefined
    return box.error ? undefined : forDb(lobby)
  })
  return { lobby: raw ? normalizeLobby({ id: lobbyId, ...raw }) : null, error: box.error }
}

async function deleteLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string) {
  await firebase.updateData({ [lobbyPath(instanceId, lobbyId)]: null })
}

/** Ace defaults to high (14) until rigAce fixes it to 1 or 14 for the rest of the game. */
function cardValue(card: Card, ace: 1 | 14 = 14): number {
  if (card.rank === "A") return ace
  if (card.rank === "K") return 13
  if (card.rank === "Q") return 12
  if (card.rank === "J") return 11
  return Number(card.rank)
}

/** Up/down round: picks the ace value that makes the guesser lose, if an ace is involved at all.
 * Drawn ace: "up" -> low (1), "down" -> high (14). Held ace, non-ace drawn: "up" -> high, "down" -> low.
 * "Same" (or no ace) leaves it undecided - an ace can never match a non-ace either way. */
function rigAce(guess: string, drawn: Card, prev: Card): 1 | 14 | undefined {
  if (guess !== "up" && guess !== "down") return undefined
  if (drawn.rank === "A") return guess === "up" ? 1 : 14
  if (prev.rank === "A") return guess === "up" ? 14 : 1
  return undefined
}

const isRed = (card: Card) => card.suit === "♥" || card.suit === "♦"

/** Whether a guess in the given phase-1 round is correct. `hand` is the player's cards *before* the draw. */
function evaluateGuess(round: Exclude<RbRound, "DONE">, guess: string, card: Card, hand: Card[], ace: 1 | 14 = 14): boolean | null {
  const v = cardValue(card, ace)
  if (round === "RB") {
    if (guess !== "red" && guess !== "black") return null
    return guess === "red" ? isRed(card) : !isRed(card)
  }
  if (round === "UD") {
    const prev = cardValue(hand[hand.length - 1], ace)
    if (guess === "up") return v > prev
    if (guess === "down") return v < prev
    if (guess === "same") return v === prev
    return null
  }
  if (round === "IO") {
    const values = hand.map((c) => cardValue(c, ace)).sort((a, b) => a - b)
    const low = values[0]
    const high = values[values.length - 1]
    if (guess === "in") return v > low && v < high
    if (guess === "out") return v < low || v > high
    if (guess === "same") return v === low || v === high
    return null
  }
  // SUIT: do you already hold a card of the next card's suit?
  if (guess !== "yes" && guess !== "no") return null
  const has = hand.some((c) => c.suit === card.suit)
  return guess === "yes" ? has : !has
}

function buildGtCards(deck: Card[]): { cards: GtCard[]; deck: Card[] } {
  const cards: GtCard[] = []
  let remaining = deck
  const draw = () => {
    const d = drawCard(remaining)
    remaining = d.remaining
    return d.card
  }
  for (let row = 1; row <= GT_ROWS; row++) {
    for (const lane of [0, 1, 2] as Lane[]) cards.push({ card: draw(), lane, row, revealed: false })
  }
  cards.push({ card: draw(), lane: 3, row: GT_ROWS + 1, revealed: false })
  return { cards, deck: remaining }
}

/** Most cards left loses; ties broken by highest card total. Anyone still tied after that picks who rides. */
function findLosers(lobby: RedBlackLobby): string[] {
  let best: string[] = []
  let bestCount = -1
  let bestSum = -1
  for (const id of lobby.playerOrder) {
    const cards = lobby.players[id].cards
    const sum = cards.reduce((s, c) => s + cardValue(c, lobby.aceValue), 0)
    if (cards.length > bestCount || (cards.length === bestCount && sum > bestSum)) {
      best = [id]
      bestCount = cards.length
      bestSum = sum
    } else if (cards.length === bestCount && sum === bestSum) {
      best.push(id)
    }
  }
  return best
}

function startBus(lobby: RedBlackLobby, loserId: string) {
  let deck = freshShuffledDeck()
  const cards: BusCard[] = []
  for (let i = 0; i < BUS_LENGTH; i++) {
    const d = drawCard(deck)
    deck = d.remaining
    cards.push({ card: d.card, revealed: i === 0 })
  }
  lobby.deck = deck
  lobby.bus = { stage: "riding", candidates: [], loserId, cards, nextIndex: 1, totalSips: 0, awaitingRetry: false }
}

// ---------- view ----------

const HIDDEN: Card = { rank: "?", suit: "?" as Card["suit"] }

function publicView(lobby: RedBlackLobby, userId: string) {
  // During the Give/Take phase your hand is your own business - you're the only one who knows what
  // you can lay. Everywhere else hands are open (phase 1 is played face up, and the bus needs the tally).
  const hideOthers = lobby.phase === "gt"
  const gt = lobby.gt
  const bus = lobby.bus
  const turnPlayerId =
    lobby.phase === "rb" && lobby.rbRound !== "DONE"
      ? lobby.playerOrder[lobby.turnIndex % Math.max(1, lobby.playerOrder.length)]
      : lobby.phase === "bus"
        ? (bus?.loserId ?? null)
        : null

  return {
    id: lobby.id,
    version: lobby.updatedAt,
    hostId: lobby.hostId,
    phase: lobby.phase,
    rbRound: lobby.rbRound,
    rbSips: lobby.rbRound === "DONE" ? 0 : RB_ROUND_SIPS[lobby.rbRound],
    iAmPlaying: !!lobby.players[userId],
    iAmSpectating: lobby.spectators[userId] !== undefined,
    spectators: Object.entries(lobby.spectators).map(([id, s]) => ({ id, username: s.username, avatar: discordAvatarUrl(id, s.avatar, 32) })),
    players: lobby.playerOrder.map((id) => {
      const p = lobby.players[id]
      return {
        id: p.id,
        username: p.username,
        avatar: discordAvatarUrl(p.id, p.avatar, 64),
        cardCount: p.cards.length,
        cards: hideOthers && id !== userId ? p.cards.map(() => HIDDEN) : p.cards,
      }
    }),
    turnPlayerId,
    last: lobby.last,
    gt: gt
      ? {
          cards: gt.cards.map((c) => ({ ...c, card: c.revealed ? c.card : HIDDEN })),
          nextIndex: gt.nextIndex,
          placements: gt.placements,
          sipsPerRow: GT_SIPS_PER_ROW,
          flipRemainingMs: Math.max(0, gt.flippedAt + GT_FLIP_COOLDOWN_MS - Date.now()),
        }
      : undefined,
    bus: bus
      ? {
          stage: bus.stage,
          candidates: bus.candidates.map((id) => ({ id, username: lobby.players[id]?.username ?? "?" })),
          loserId: bus.loserId ?? null,
          cards: bus.cards.map((c) => ({ ...c, card: c.revealed ? c.card : HIDDEN })),
          nextIndex: bus.nextIndex,
          totalSips: bus.totalSips,
          awaitingRetry: bus.awaitingRetry,
          last: bus.last,
        }
      : undefined,
    serverNow: Date.now(),
  }
}

// ---------- lobby management ----------

async function leaveLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string, userId: string) {
  const peek = await readLobby(firebase, instanceId, lobbyId)
  if (!peek) return
  if (peek.players[userId] && (peek.hostId === userId || peek.playerOrder.length <= 1)) {
    await deleteLobby(firebase, instanceId, lobbyId)
    return
  }

  await updateLobby(firebase, instanceId, lobbyId, (lobby) => {
    if (lobby.spectators[userId] !== undefined) {
      delete lobby.spectators[userId]
      return
    }
    if (!lobby.players[userId]) return

    const playerOrder = lobby.playerOrder.filter((id) => id !== userId)
    const leavingIndex = lobby.playerOrder.indexOf(userId)
    let turnIndex = lobby.turnIndex
    if (leavingIndex < turnIndex) turnIndex--
    const wrapped = turnIndex >= playerOrder.length
    turnIndex %= Math.max(1, playerOrder.length)

    delete lobby.players[userId]
    lobby.playerOrder = playerOrder
    lobby.turnIndex = turnIndex
    if (lobby.last?.playerId === userId) delete lobby.last

    // If the leaver was the last one to still have a turn this round, the round is over.
    if (lobby.phase === "rb" && wrapped && lobby.rbRound !== "DONE") lobby.rbRound = RB_ORDER[RB_ORDER.indexOf(lobby.rbRound) + 1]

    if (lobby.phase === "bus" && lobby.bus) {
      lobby.bus.candidates = lobby.bus.candidates.filter((id) => id !== userId)
      if (lobby.bus.loserId === userId) lobby.phase = "finished"
      else if (lobby.bus.stage === "pickLoser" && lobby.bus.candidates.length === 1) startBus(lobby, lobby.bus.candidates[0])
    }
  })
}

async function leaveOtherLobbies(firebase: FirebaseHelper, instanceId: string, userId: string, exceptLobbyId?: string) {
  const all = await readAllLobbies(firebase, instanceId)
  for (const lobbyId of Object.keys(all)) {
    if (lobbyId === exceptLobbyId) continue
    if (all[lobbyId].spectators[userId] !== undefined || all[lobbyId].players[userId]) await leaveLobby(firebase, instanceId, lobbyId, userId)
  }
}

const playerFrom = (user: AuthenticatedDiscordUser): RbPlayer => ({ id: user.id, username: user.globalName ?? user.username, avatar: user.avatar, cards: [] })

export async function listRedBlackLobbies(instanceId: string, userId: string) {
  const firebase = new FirebaseHelper()
  const all = await readAllLobbies(firebase, instanceId)
  const lobbies = Object.values(all).map((l) => ({
    id: l.id,
    hostUsername: l.players[l.hostId]?.username ?? "?",
    numPlayers: l.playerOrder.length,
    numSpectators: Object.keys(l.spectators).length,
    phase: l.phase,
  }))
  const myLobbyId = Object.values(all).find((l) => l.players[userId] || l.spectators[userId] !== undefined)?.id ?? null
  return Response.json({ lobbies, myLobbyId })
}

export async function createRedBlackLobby(instanceId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  await leaveOtherLobbies(firebase, instanceId, user.id)

  const lobbyId = `${user.id}-${Date.now()}`
  const lobby: RedBlackLobby = {
    id: lobbyId,
    hostId: user.id,
    phase: "waiting",
    rbRound: "RB",
    players: { [user.id]: playerFrom(user) },
    playerOrder: [user.id],
    spectators: {},
    deck: [],
    turnIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await writeLobby(firebase, instanceId, lobbyId, lobby)
  return Response.json(publicView(lobby, user.id))
}

const STARTED = "Spillet har allerede startet - du kan se på i stedet"

export async function joinRedBlackLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const peek = await readLobby(firebase, instanceId, lobbyId)
  if (!peek) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })
  if (peek.players[user.id]) return Response.json(publicView(peek, user.id))
  if (peek.phase !== "waiting" && peek.phase !== "finished") return Response.json({ error: STARTED }, { status: 400 })

  await leaveOtherLobbies(firebase, instanceId, user.id, lobbyId)
  const { lobby, error } = await updateLobby(firebase, instanceId, lobbyId, (current) => {
    if (current.players[user.id]) return
    if (current.phase !== "waiting" && current.phase !== "finished") return STARTED
    delete current.spectators[user.id]
    current.players[user.id] = playerFrom(user)
    current.playerOrder.push(user.id)
  })
  if (!lobby) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })
  if (error) return Response.json({ error }, { status: 400 })
  return Response.json(publicView(lobby, user.id))
}

export async function spectateRedBlackLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const peek = await readLobby(firebase, instanceId, lobbyId)
  if (!peek) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })
  if (peek.players[user.id]) return Response.json({ error: "Du sitter allerede ved bordet" }, { status: 400 })
  if (peek.spectators[user.id] !== undefined) return Response.json(publicView(peek, user.id))

  await leaveOtherLobbies(firebase, instanceId, user.id, lobbyId)
  const { lobby } = await updateLobby(firebase, instanceId, lobbyId, (current) => {
    if (!current.players[user.id]) current.spectators[user.id] = { username: user.globalName ?? user.username, avatar: user.avatar }
  })
  if (!lobby) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })
  return Response.json(publicView(lobby, user.id))
}

export async function leaveRedBlackLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  await leaveLobby(firebase, instanceId, lobbyId, user.id)
  return Response.json({ ok: true })
}

export async function getRedBlackLobbyStatus(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true })
  return Response.json(publicView(lobby, user.id))
}

// ---------- game actions ----------

interface ActionInput {
  guess?: string
  loserId?: string
}

/** A game action: `apply` mutates the lobby in place and returns an error message to reject the action instead (see updateLobby -
 * it's atomic, which matters here: in the Give/Take phase everyone lays cards at the same moment). */
async function mutate(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser, apply: (lobby: RedBlackLobby) => string | void) {
  const firebase = new FirebaseHelper()
  const { lobby, error } = await updateLobby(firebase, instanceId, lobbyId, apply)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  if (error) return Response.json({ error }, { status: 400 })
  return Response.json(publicView(lobby, user.id))
}

export async function redBlackAction(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser, action: string, input: ActionInput) {
  return mutate(instanceId, lobbyId, user, (lobby) => {
    const me = lobby.players[user.id]
    if (!me) return "Du er ikke ved dette bordet"

    if (action === "start") {
      if (lobby.hostId !== user.id) return "Bare verten kan starte spillet"
      for (const id of lobby.playerOrder) lobby.players[id].cards = []
      lobby.deck = freshShuffledDeck()
      lobby.phase = "rb"
      lobby.rbRound = "RB"
      lobby.turnIndex = 0
      delete lobby.last
      delete lobby.aceValue
      delete lobby.gt
      delete lobby.bus
      return
    }

    if (action === "guess") {
      if (lobby.phase !== "rb" || lobby.rbRound === "DONE") return "Ingen runde pågår"
      if (lobby.playerOrder[lobby.turnIndex] !== user.id) return "Ikke din tur"
      const round = lobby.rbRound
      const drawn = drawCard(lobby.deck)
      // Up/down: the first time an ace decides the outcome, its value is fixed against the guesser.
      if (round === "UD" && lobby.aceValue === undefined) {
        const rigged = rigAce(input.guess ?? "", drawn.card, me.cards[me.cards.length - 1])
        if (rigged) lobby.aceValue = rigged
      }
      const correct = evaluateGuess(round, input.guess ?? "", drawn.card, me.cards, lobby.aceValue)
      if (correct === null) return "Ugyldig gjetning"

      lobby.deck = drawn.remaining
      me.cards.push(drawn.card)
      lobby.last = { playerId: user.id, username: me.username, round, guess: input.guess!, card: drawn.card, correct, sips: RB_ROUND_SIPS[round] }
      lobby.turnIndex++
      if (lobby.turnIndex >= lobby.playerOrder.length) {
        lobby.turnIndex = 0
        lobby.rbRound = RB_ORDER[RB_ORDER.indexOf(round) + 1]
      }
      return
    }

    if (action === "nextPhase") {
      if (lobby.phase !== "rb" || lobby.rbRound !== "DONE") return "Fase 1 er ikke ferdig"
      // Never decided during up/down - flip a coin now so aces still have one fixed value from here on.
      if (lobby.aceValue === undefined) lobby.aceValue = Math.random() < 0.5 ? 1 : 14
      const built = buildGtCards(lobby.deck)
      lobby.deck = built.deck
      lobby.phase = "gt"
      lobby.gt = { cards: built.cards, nextIndex: 0, flippedAt: 0, placements: [] }
      return
    }

    if (action === "gtFlip") {
      const gt = lobby.gt
      if (lobby.phase !== "gt" || !gt) return "Ikke i Gi/Ta-fasen"
      if (gt.nextIndex >= gt.cards.length) return "Alle kortene er snudd"
      if (Date.now() < gt.flippedAt + GT_FLIP_COOLDOWN_MS) return "Vent litt så alle rekker å legge ned kort"
      gt.cards[gt.nextIndex].revealed = true
      gt.nextIndex++
      gt.flippedAt = Date.now()
      gt.placements = []
      return
    }

    if (action === "gtPlace") {
      const gt = lobby.gt
      if (lobby.phase !== "gt" || !gt || gt.nextIndex === 0) return "Ingen kort å legge på"
      const current = gt.cards[gt.nextIndex - 1].card
      const idx = me.cards.findIndex((c) => c.rank === current.rank)
      if (idx < 0) return "Du har ikke noe kort å legge"
      const [placed] = me.cards.splice(idx, 1)
      gt.placements.push({ playerId: user.id, username: me.username, card: placed })
      return
    }

    if (action === "revealLoser") {
      const gt = lobby.gt
      if (lobby.phase !== "gt" || !gt) return "Ikke i Gi/Ta-fasen"
      if (gt.nextIndex < gt.cards.length) return "Alle kortene må snus først"
      if (Date.now() < gt.flippedAt + GT_FLIP_COOLDOWN_MS) return "Vent litt så alle rekker å legge ned kort"
      const losers = findLosers(lobby)
      lobby.phase = "bus"
      if (losers.length === 1) startBus(lobby, losers[0])
      else lobby.bus = { stage: "pickLoser", candidates: losers, cards: [], nextIndex: 1, totalSips: 0, awaitingRetry: false }
      return
    }

    if (action === "pickLoser") {
      const bus = lobby.bus
      if (lobby.phase !== "bus" || !bus || bus.stage !== "pickLoser") return "Ingen skal velges nå"
      if (!input.loserId || !bus.candidates.includes(input.loserId)) return "Ugyldig valg"
      startBus(lobby, input.loserId)
      return
    }

    if (action === "busGuess") {
      const bus = lobby.bus
      if (lobby.phase !== "bus" || !bus || bus.stage !== "riding") return "Bussturen pågår ikke"
      if (bus.loserId !== user.id) return "Det er ikke du som tar bussturen"
      if (bus.awaitingRetry) return "Trykk «Prøv igjen» først"
      const guess = input.guess ?? ""
      const prev = cardValue(bus.cards[bus.nextIndex - 1].card, lobby.aceValue)
      const next = bus.cards[bus.nextIndex]
      const v = cardValue(next.card, lobby.aceValue)
      const correct = guess === "up" ? v > prev : guess === "down" ? v < prev : guess === "same" ? v === prev : null
      if (correct === null) return "Ugyldig gjetning"

      next.revealed = true
      if (correct) {
        bus.last = { guess, correct, sips: 0 }
        if (bus.nextIndex === bus.cards.length - 1) {
          bus.stage = "done"
          lobby.phase = "finished"
        } else bus.nextIndex++
      } else {
        // Wrong on the Nth card = drink N, then start over from the first one.
        bus.totalSips += bus.nextIndex
        bus.awaitingRetry = true
        bus.last = { guess, correct, sips: bus.nextIndex }
      }
      return
    }

    if (action === "busRetry") {
      const bus = lobby.bus
      if (lobby.phase !== "bus" || !bus || !bus.awaitingRetry) return "Ingenting å prøve på nytt"
      if (bus.loserId !== user.id) return "Det er ikke du som tar bussturen"
      let deck = lobby.deck
      for (let i = 1; i <= bus.nextIndex; i++) {
        const d = drawCard(deck)
        deck = d.remaining
        bus.cards[i] = { card: d.card, revealed: false }
      }
      lobby.deck = deck
      bus.nextIndex = 1
      bus.awaitingRetry = false
      delete bus.last
      return
    }

    return "Ukjent handling"
  })
}
