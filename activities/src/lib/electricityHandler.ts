import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { Card, freshShuffledDeck } from "./blackjack"
import { discordAvatarUrl } from "./discordAvatar"

type TableStatus = "waiting" | "playing"

interface ElectricityPlayer {
  id: string
  username: string
  avatar: string | null
  /** Their currently face-up card - none until they've had their first turn. */
  card: Card | null
}

interface Spectator {
  username: string
  avatar: string | null
}

interface ElectricityLobby {
  id: string
  hostId: string
  status: TableStatus
  /** Everyone chugs when the whole table connects in a full circle (vs. just drinking one sip each). */
  chugOnLoop: boolean
  players: Record<string, ElectricityPlayer>
  playerOrder: string[]
  spectators: Record<string, Spectator>
  deck: Card[]
  /** Index into playerOrder of whoever draws next. */
  turnIndex: number
  /** Who drew the most recent card - the connection chain is computed outward from them. */
  lastDrawerId?: string
  createdAt: number
  updatedAt: number
}

const PATH_PREFIX = "multiplayerElectricity"

/** Firebase RTDB drops empty arrays and null fields on write, so anything that can legitimately be
 * empty (deck, a player's card) comes back missing and is normalized here. Optional fields are only
 * spread back in when they have a real value - Firebase rejects `undefined` outright. */
function normalizeLobby(raw: any): ElectricityLobby {
  const players: Record<string, ElectricityPlayer> = {}
  for (const id of Object.keys(raw.players ?? {})) {
    const p = raw.players[id]
    players[id] = { id: p.id, username: p.username, avatar: p.avatar ?? null, card: p.card ?? null }
  }
  const spectators: Record<string, Spectator> = {}
  for (const id of Object.keys(raw.spectators ?? {})) {
    const s = raw.spectators[id]
    spectators[id] = { username: s.username, avatar: s.avatar ?? null }
  }
  return {
    id: raw.id,
    hostId: raw.hostId,
    status: raw.status ?? "waiting",
    chugOnLoop: raw.chugOnLoop ?? true,
    players,
    playerOrder: raw.playerOrder ?? [],
    spectators,
    deck: raw.deck ?? [],
    turnIndex: raw.turnIndex ?? 0,
    ...(raw.lastDrawerId ? { lastDrawerId: raw.lastDrawerId } : {}),
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? Date.now(),
  }
}

async function readLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string): Promise<ElectricityLobby | null> {
  const data = await firebase.getData(`other/${PATH_PREFIX}/${instanceId}/${lobbyId}`)
  return data ? normalizeLobby({ id: lobbyId, ...data }) : null
}

async function readAllLobbies(firebase: FirebaseHelper, instanceId: string): Promise<Record<string, ElectricityLobby>> {
  const data = (await firebase.getData(`other/${PATH_PREFIX}/${instanceId}`)) ?? {}
  const result: Record<string, ElectricityLobby> = {}
  for (const lobbyId of Object.keys(data)) result[lobbyId] = normalizeLobby({ id: lobbyId, ...data[lobbyId] })
  return result
}

async function writeLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string, lobby: ElectricityLobby) {
  await firebase.updateData({ [`other/${PATH_PREFIX}/${instanceId}/${lobbyId}`]: { ...lobby, updatedAt: Date.now() } })
}

async function deleteLobby(firebase: FirebaseHelper, instanceId: string, lobbyId: string) {
  await firebase.updateData({ [`other/${PATH_PREFIX}/${instanceId}/${lobbyId}`]: null })
}

/** Two cards "connect" if they share a rank or a suit. */
function cardsMatch(a: Card | null, b: Card | null): boolean {
  return !!a && !!b && (a.rank === b.rank || a.suit === b.suit)
}

/** Same rule as the bot's /electricity: starting at whoever just drew, follow the chain of connected
 * cards forward and backward around the table - each next player must connect to the one before them,
 * and the walk stops at the first break or once it runs into someone already counted. */
function whoMustDrink(order: string[], players: Record<string, ElectricityPlayer>, drawerIndex: number): string[] {
  const n = order.length
  const cards = order.map((id) => players[id].card)
  const included = new Set<number>()

  const walk = (start: number, step: 1 | -1) => {
    let current = cards[drawerIndex]
    for (let k = 0; k < n; k++) {
      const idx = (((start + step * k) % n) + n) % n
      if (included.has(idx) || !cardsMatch(cards[idx], current)) return
      included.add(idx)
      current = cards[idx]
    }
  }
  walk(drawerIndex, 1)
  walk(drawerIndex - 1, -1)
  return [...included].sort((a, b) => a - b).map((i) => order[i])
}

/** Every neighbour (wrapping) connects - i.e. the chain closes into a loop and never has to stop. */
function isInfinite(order: string[], players: Record<string, ElectricityPlayer>): boolean {
  return order.every((id, i) => cardsMatch(players[id].card, players[order[(i + 1) % order.length]].card))
}

function publicView(lobby: ElectricityLobby, userId: string) {
  const drawerIndex = lobby.lastDrawerId ? lobby.playerOrder.indexOf(lobby.lastDrawerId) : -1
  let drinkers: string[] = []
  let sips: number | "inf" = 0
  if (lobby.status === "playing" && drawerIndex >= 0) {
    drinkers = whoMustDrink(lobby.playerOrder, lobby.players, drawerIndex)
    // A single "connection" is just the drawer matching themselves - nobody actually drinks then.
    if (drinkers.length <= 1) drinkers = []
    else if (drinkers.length === lobby.playerOrder.length && lobby.chugOnLoop && isInfinite(lobby.playerOrder, lobby.players)) sips = "inf"
    else sips = drinkers.length
  }
  return {
    id: lobby.id,
    hostId: lobby.hostId,
    status: lobby.status,
    chugOnLoop: lobby.chugOnLoop,
    iAmPlaying: !!lobby.players[userId],
    iAmSpectating: lobby.spectators[userId] !== undefined,
    spectators: Object.entries(lobby.spectators).map(([id, s]) => ({ id, username: s.username, avatar: discordAvatarUrl(id, s.avatar, 32) })),
    players: lobby.playerOrder.map((id) => {
      const p = lobby.players[id]
      return { id: p.id, username: p.username, avatar: discordAvatarUrl(p.id, p.avatar, 64), card: p.card }
    }),
    turnPlayerId: lobby.status === "playing" ? lobby.playerOrder[lobby.turnIndex % Math.max(1, lobby.playerOrder.length)] : null,
    lastDrawerId: lobby.lastDrawerId ?? null,
    drinkers,
    sips,
    deckCount: lobby.deck.length,
  }
}

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

  const playerOrder = lobby.playerOrder.filter((id) => id !== userId)
  if (lobby.hostId === userId || playerOrder.length === 0) {
    await deleteLobby(firebase, instanceId, lobbyId)
    return
  }

  const leavingIndex = lobby.playerOrder.indexOf(userId)
  let turnIndex = lobby.turnIndex
  if (leavingIndex < turnIndex) turnIndex--
  turnIndex %= playerOrder.length

  const players = { ...lobby.players }
  delete players[userId]
  const { lastDrawerId, ...rest } = lobby
  await writeLobby(firebase, instanceId, lobbyId, {
    ...rest,
    players,
    playerOrder,
    turnIndex,
    // The chain is only meaningful relative to the last drawer - if they left, there's nothing to show.
    ...(lastDrawerId && lastDrawerId !== userId ? { lastDrawerId } : {}),
  })
}

/** You can only be at one lobby per voice channel at a time - switching quietly leaves the old one. */
async function leaveOtherLobbies(firebase: FirebaseHelper, instanceId: string, userId: string, exceptLobbyId?: string) {
  const all = await readAllLobbies(firebase, instanceId)
  for (const lobbyId of Object.keys(all)) {
    if (lobbyId === exceptLobbyId) continue
    if (all[lobbyId].spectators[userId] !== undefined || all[lobbyId].players[userId]) await leaveLobby(firebase, instanceId, lobbyId, userId)
  }
}

export async function listElectricityLobbies(instanceId: string, userId: string) {
  const firebase = new FirebaseHelper()
  const all = await readAllLobbies(firebase, instanceId)
  const lobbies = Object.values(all).map((l) => ({
    id: l.id,
    hostUsername: l.players[l.hostId]?.username ?? "?",
    numPlayers: l.playerOrder.length,
    numSpectators: Object.keys(l.spectators).length,
    status: l.status,
  }))
  const myLobbyId = Object.values(all).find((l) => l.players[userId] || l.spectators[userId] !== undefined)?.id ?? null
  return Response.json({ lobbies, myLobbyId })
}

export async function createElectricityLobby(instanceId: string, user: AuthenticatedDiscordUser, chugOnLoop: boolean) {
  const firebase = new FirebaseHelper()
  await leaveOtherLobbies(firebase, instanceId, user.id)

  const lobbyId = `${user.id}-${Date.now()}`
  const lobby: ElectricityLobby = {
    id: lobbyId,
    hostId: user.id,
    status: "waiting",
    chugOnLoop,
    players: { [user.id]: { id: user.id, username: user.globalName ?? user.username, avatar: user.avatar, card: null } },
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

export async function joinElectricityLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })

  if (!lobby.players[user.id]) {
    if (lobby.status === "playing") return Response.json({ error: "Spillet har allerede startet - du kan se på i stedet" }, { status: 400 })
    await leaveOtherLobbies(firebase, instanceId, user.id, lobbyId)
    delete lobby.spectators[user.id]
    lobby.players[user.id] = { id: user.id, username: user.globalName ?? user.username, avatar: user.avatar, card: null }
    lobby.playerOrder.push(user.id)
    await writeLobby(firebase, instanceId, lobbyId, lobby)
  }
  return Response.json(publicView(lobby, user.id))
}

export async function spectateElectricityLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ error: "Bordet finnes ikke lenger" }, { status: 404 })
  if (lobby.players[user.id]) return Response.json({ error: "Du sitter allerede ved bordet" }, { status: 400 })

  if (lobby.spectators[user.id] === undefined) {
    await leaveOtherLobbies(firebase, instanceId, user.id, lobbyId)
    lobby.spectators[user.id] = { username: user.globalName ?? user.username, avatar: user.avatar }
    await writeLobby(firebase, instanceId, lobbyId, lobby)
  }
  return Response.json(publicView(lobby, user.id))
}

export async function leaveElectricityLobby(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  await leaveLobby(firebase, instanceId, lobbyId, user.id)
  return Response.json({ ok: true })
}

export async function getElectricityLobbyStatus(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true })
  return Response.json(publicView(lobby, user.id))
}

/** Host-only: shuffles a fresh deck and starts the first turn. Also used to restart a finished game. */
export async function startElectricity(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  if (lobby.hostId !== user.id) return Response.json({ error: "Bare verten kan starte spillet" }, { status: 403 })

  for (const id of lobby.playerOrder) lobby.players[id] = { ...lobby.players[id], card: null }
  lobby.deck = freshShuffledDeck()
  lobby.status = "playing"
  lobby.turnIndex = 0
  delete lobby.lastDrawerId
  await writeLobby(firebase, instanceId, lobbyId, lobby)
  return Response.json(publicView(lobby, user.id))
}

export async function drawElectricityCard(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  if (lobby.status !== "playing") return Response.json({ error: "Spillet har ikke startet" }, { status: 400 })

  const turnPlayerId = lobby.playerOrder[lobby.turnIndex % lobby.playerOrder.length]
  if (turnPlayerId !== user.id) return Response.json({ error: "Ikke din tur" }, { status: 400 })
  if (lobby.deck.length === 0) return Response.json({ error: "Kortstokken er tom - stokk om for å fortsette" }, { status: 400 })

  const [card, ...deck] = lobby.deck
  lobby.deck = deck
  lobby.players[user.id] = { ...lobby.players[user.id], card }
  lobby.lastDrawerId = user.id
  lobby.turnIndex = (lobby.turnIndex + 1) % lobby.playerOrder.length
  await writeLobby(firebase, instanceId, lobbyId, lobby)
  return Response.json(publicView(lobby, user.id))
}

/** Any seated player can reshuffle once the deck runs dry - cards currently face up on the table
 * are left out of the new deck, so the same card never exists twice at once. */
export async function reshuffleElectricity(instanceId: string, lobbyId: string, user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const lobby = await readLobby(firebase, instanceId, lobbyId)
  if (!lobby) return Response.json({ closed: true }, { status: 404 })
  if (!lobby.players[user.id]) return Response.json({ error: "Du er ikke ved dette bordet" }, { status: 400 })
  if (lobby.deck.length > 0) return Response.json({ error: "Kortstokken er ikke tom" }, { status: 400 })

  const onTable = lobby.playerOrder.map((id) => lobby.players[id].card).filter((c): c is Card => !!c)
  lobby.deck = freshShuffledDeck().filter((c) => !onTable.some((t) => t.rank === c.rank && t.suit === c.suit))
  await writeLobby(firebase, instanceId, lobbyId, lobby)
  return Response.json(publicView(lobby, user.id))
}
