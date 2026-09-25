import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"
import { dondSpectateButtonComponent, lootButtonComponent, postChannelMessage, resolveAnnounceChannel } from "./discordMessage"
import { discordAvatarUrl } from "./discordAvatar"
import { DOND_CASES, DOND_TIER_K, DondTier, JAIL_MULTIPLIER, ANNOUNCE_CHANNEL_ID, dondValues } from "./gameValues"
import { DondEffect, effectPoolForOffer, findEffect } from "./dondItems"

// Port of commands/games/dealOrNoDeal.ts from the bot repo - a solo game, one per user, stored at
// other/dondGames/{userId} so a refresh (or closing the Activity) never loses a round in progress.
// Starting one costs a Deal or No Deal token (users/{id}/dondTokens, granted by /reward dealornodeal).

type State = "opening" | "offer" | "keepOrSwitch" | "done"

type Offer = { kind: "chips"; amount: number } | { kind: "effect"; id: string; label: string }

interface DondResult {
  outcome: "deal" | "kept" | "switched"
  chips?: number
  effectLabel?: string
  playerCaseValue: number
  /** The other case that was still closed when the game ended (only when the bank's deal was accepted or at keep/switch). */
  otherCaseValue?: number
}

interface DondGame {
  tier: DondTier
  /** Shown to spectators. */
  playerName: string
  /** Where this round's announcements go: the channel the Activity was launched from (when it's usable), else the default announce channel. */
  channelId?: string
  /** values[i] is what case number i + 1 holds - never sent to the client for a closed case. */
  values: number[]
  opened: boolean[]
  playerCase: number
  /** The case they picked at the start - playerCase changes if they switch, the recap needs the original. */
  startCase?: number
  round: number
  casesOpened: number
  state: State
  updatedAt?: number
  offer?: Offer
  result?: DondResult
}

const TIERS: DondTier[] = ["basic", "premium", "elite"]
const NUM_CASES = 26
const MAX_ROUNDS = 10

const gamePath = (userId: string) => `other/dondGames/${userId}`

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Total cases that must be open by the end of `round` - 6, 5, 4, 3, 2, then one more per round. */
function casesOpenedByEndOfRound(round: number): number {
  let total = 0
  for (let i = 0; i < round; i++) total += Math.max(1, 6 - i)
  return total
}

async function readGame(firebase: FirebaseHelper, userId: string): Promise<DondGame | null> {
  const raw = await firebase.getData(gamePath(userId))
  if (!raw) return null
  return { ...raw, opened: raw.opened ?? [], values: raw.values ?? [] }
}

async function writeGame(firebase: FirebaseHelper, userId: string, game: DondGame) {
  // The JSON round-trip strips `undefined` fields, which Firebase rejects outright.
  await firebase.updateData({ [gamePath(userId)]: JSON.parse(JSON.stringify({ ...game, updatedAt: Date.now() })) })
}

function tokensOf(dbUser: any): Record<DondTier, number> {
  return { basic: dbUser.dondTokens?.basic ?? 0, premium: dbUser.dondTokens?.premium ?? 0, elite: dbUser.dondTokens?.elite ?? 0 }
}

/** What the client gets. Closed cases' values, and the player's own case, stay hidden until the game is over. */
function publicView(game: DondGame) {
  const done = game.state === "done"
  const openedValues = new Set(game.values.filter((_, i) => game.opened[i]))
  const remainingOther = game.values.map((_, i) => i + 1).filter((nr) => !game.opened[nr - 1] && nr !== game.playerCase)
  const casesToOpen = game.state === "opening" ? casesOpenedByEndOfRound(game.round) - game.casesOpened : 0
  return {
    tier: game.tier,
    k: DOND_TIER_K[game.tier],
    state: game.state,
    round: game.round,
    casesToOpen,
    playerCase: game.playerCase,
    // Every value on the board, sorted - which of them are gone is public, where the rest are is not.
    board: [...game.values].sort((a, b) => a - b).map((value) => ({ value, eliminated: openedValues.has(value) })),
    cases: game.values.map((value, i) => ({ nr: i + 1, opened: !!game.opened[i], value: game.opened[i] ? value : undefined, mine: i + 1 === game.playerCase })),
    offer: game.state === "offer" ? game.offer : undefined,
    otherCase: game.state === "keepOrSwitch" ? remainingOther[0] : undefined,
    result: done ? game.result : undefined,
  }
}

function computeOffer(game: DondGame): Offer {
  const unopened = game.values.filter((_, i) => !game.opened[i])
  const expected = unopened.reduce((sum, v) => sum + v, 0) / Math.max(1, unopened.length)
  const percentage = dondValues.offerBase + game.round * dondValues.offerPerRound
  const chips = Math.round(expected * percentage)

  if (Math.random() * 100 < dondValues.effectItemChance) {
    const pool = effectPoolForOffer(chips)
    const effect = pool[Math.floor(Math.random() * pool.length)]
    return { kind: "effect", id: effect.id, label: effect.label }
  }
  return { kind: "chips", amount: chips }
}

/** Same bookkeeping as the bot's updateUserStats, field for field, so /stats keeps working on both sides.
 * Kept faithful on purpose - including that "gameValue" is the value of the player's own case, as the bot passes it. */
function updatedStats(
  dbUser: any,
  tier: DondTier,
  valueWon: number,
  gameValue: number,
  opts: { fromDeal?: boolean; remainingCaseValue?: number; keptCase?: boolean; acceptedEffect?: boolean }
) {
  const defaultStats = () => ({
    totalGames: 0,
    timesAcceptedDeal: 0,
    totalMissedMoney: 0,
    winningsFromKeepOrSwitch: 0,
    timesWonLessThan1000: 0,
    winningsFromAcceptDeal: 0,
    winsOfOne: 0,
    keepSwitchBalance: 0,
    keepWasCorrectChoice: 0,
    switchWasCorrectChoice: 0,
    userWasCorrect: 0,
    acceptedEffect: 0,
  })
  const stats = dbUser.userStats?.dondStats ?? { tenKStats: defaultStats(), twentyKStats: defaultStats(), fiftyKStats: defaultStats() }
  const key = tier === "elite" ? "fiftyKStats" : tier === "premium" ? "twentyKStats" : "tenKStats"
  const s = { ...defaultStats(), ...stats[key] }

  s.totalGames++
  s.totalMissedMoney += gameValue - valueWon
  if (valueWon < 1000) s.timesWonLessThan1000++
  if (valueWon === 1) s.winsOfOne++
  if (opts.fromDeal) {
    s.timesAcceptedDeal++
    s.winningsFromAcceptDeal += valueWon
  } else {
    s.winningsFromKeepOrSwitch += valueWon
    if (opts.remainingCaseValue) {
      if (valueWon > opts.remainingCaseValue) s.userWasCorrect++
      if (opts.keptCase && valueWon > opts.remainingCaseValue) s.keepWasCorrectChoice++
      else s.switchWasCorrectChoice++
      s.keepSwitchBalance += valueWon - opts.remainingCaseValue
    }
  }
  if (opts.acceptedEffect) s.acceptedEffect++

  return { ...stats, [key]: s }
}

function jailAdjusted(dbUser: any, chips: number) {
  return Math.floor((dbUser.jail?.daysInJail ?? 0) > 0 ? chips * JAIL_MULTIPLIER : chips)
}

async function announce(body: Parameters<typeof postChannelMessage>[1], channelId?: string) {
  const target = channelId ?? ANNOUNCE_CHANNEL_ID
  try {
    // The launch channel might be one the bot can't post in - the usual place is always a safe fallback.
    if (!(await postChannelMessage(target, body)) && target !== ANNOUNCE_CHANNEL_ID) await postChannelMessage(ANNOUNCE_CHANNEL_ID, body)
  } catch {
    // Best-effort - the game result is already saved.
  }
}

// ---------- spectators ----------

/** Spectators announce themselves by polling - each poll refreshes their entry, and one that hasn't been refreshed
 * in a few poll intervals has left. Kept apart from the game record like the chat, so a heartbeat never races a game action. */
const spectatorsPath = (hostId: string) => `other/dondSpectators/${hostId}`
const SPECTATOR_TIMEOUT_MS = 8000
/** A round nobody has touched for this long is treated as abandoned and left out of the list of running rounds. */
const ACTIVE_GAME_MAX_AGE_MS = 12 * 60 * 60 * 1000

async function readSpectators(firebase: FirebaseHelper, hostId: string) {
  const raw = await firebase.getData(spectatorsPath(hostId))
  if (!raw) return []
  const now = Date.now()
  return Object.entries(raw as Record<string, { name: string; avatar?: string | null; at: number }>)
    .filter(([, s]) => now - s.at < SPECTATOR_TIMEOUT_MS)
    .map(([id, s]) => ({ id, username: s.name, avatar: discordAvatarUrl(id, s.avatar ?? null, 32) }))
}

/** Every running round except your own, newest activity first - lets people find a round to watch without the announcement button. */
export async function listActiveDondGames(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const all = ((await firebase.getData("other/dondGames")) ?? {}) as Record<string, any>
  const cutoff = Date.now() - ACTIVE_GAME_MAX_AGE_MS
  const games = Object.entries(all)
    .filter(([id, g]) => id !== user.id && g.state !== "done" && (g.updatedAt ?? 0) > cutoff)
    .map(([id, g]) => ({ hostId: id, playerName: g.playerName ?? "?", k: DOND_TIER_K[g.tier as DondTier] ?? 0, round: g.round, state: g.state, updatedAt: g.updatedAt as number }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  return Response.json({ games })
}

// ---------- chat ----------

interface ChatMessage {
  userId: string
  name: string
  text: string
  at: number
}

const CHAT_MAX_LENGTH = 200
const CHAT_MAX_MESSAGES = 500
const CHAT_VISIBLE = 100

/** One Firebase child per message (unique key), separate from the game record - a chat write can never
 * clobber a game action's read-modify-write of the game, or the other way around. */
const chatPath = (hostId: string) => `other/dondChat/${hostId}`

async function readChat(firebase: FirebaseHelper, hostId: string): Promise<ChatMessage[]> {
  const raw = await firebase.getData(chatPath(hostId))
  if (!raw) return []
  return (Object.values(raw) as ChatMessage[]).sort((a, b) => a.at - b.at)
}

/** Anyone at the round - the player or a spectator - can post to it. `hostIdInput` is whose round the chat belongs to. */
export async function postDondChat(user: AuthenticatedDiscordUser, hostIdInput: unknown, textInput: unknown) {
  const firebase = new FirebaseHelper()
  const hostId = typeof hostIdInput === "string" && hostIdInput ? hostIdInput : user.id
  const text = String(textInput ?? "").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX_LENGTH)
  if (!text) return err("Skriv noe først")

  if (!(await readGame(firebase, hostId))) return err("Ingen aktiv runde å chatte i")
  const chat = await readChat(firebase, hostId)
  if (chat.length >= CHAT_MAX_MESSAGES) return err("Chatten er full")

  const message: ChatMessage = { userId: user.id, name: user.globalName ?? user.username, text, at: Date.now() }
  const key = `${message.at}-${Math.random().toString(36).slice(2, 6)}`
  await firebase.updateData({ [`${chatPath(hostId)}/${key}`]: message })
  return Response.json({ chat: [...chat, message].slice(-CHAT_VISIBLE) })
}

const fmtChips = (n: number) => n.toLocaleString("nb-NO")

/** Embed posted when a round ends: who played, tier, outcome and what the original case held up top,
 * then the round's chat underneath. Mentions inside it never ping (see allowed_mentions where it's sent). */
function recapEmbed(userId: string, game: DondGame, chat: ChatMessage[]) {
  const result = game.result as DondResult
  const originalValue = result.outcome === "switched" ? (result.otherCaseValue ?? 0) : result.playerCaseValue
  const outcome = result.outcome === "deal" ? "Tok bankens tilbud" : result.outcome === "switched" ? "Byttet koffert" : "Beholdt kofferten"
  const reward = result.effectLabel ?? `${fmtChips(result.chips ?? 0)} chips`

  const description = [
    `**Spiller:** <@${userId}>`,
    `**Type:** ${DOND_TIER_K[game.tier]}K`,
    `**Utfall:** ${outcome} - ${reward}`,
    `**Kofferten (nr ${game.startCase ?? game.playerCase}) inneholdt:** ${fmtChips(originalValue)} chips`,
  ].join("\n")

  // The player's own lines are bold, like in the Activity. Newest lines win when the chat is longer than
  // an embed can hold (a field value caps at 1024 chars, the whole embed at 6000).
  const lines = chat.map((m) => (m.userId === userId ? `**${m.name}**: ${m.text}` : `${m.name}: ${m.text}`))
  const kept: string[] = []
  let budget = 3800
  let dropped = 0
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].length + 1 > budget) {
      dropped = i + 1
      break
    }
    budget -= lines[i].length + 1
    kept.unshift(lines[i])
  }

  const fields: { name: string; value: string }[] = []
  let chunk: string[] = []
  let size = 0
  const flush = () => {
    if (chunk.length === 0) return
    fields.push({ name: fields.length === 0 ? "💬 Chat" : "\u200b", value: chunk.join("\n") })
    chunk = []
    size = 0
  }
  for (const line of kept) {
    if (size + line.length + 1 > 1000) flush()
    chunk.push(line)
    size += line.length + 1
  }
  flush()
  if (dropped > 0 && fields.length > 0) fields[0].value = `*(${dropped} eldre meldinger utelatt)*\n${fields[0].value}`

  return { title: "Deal or No Deal - oppsummering", description, fields }
}

async function postRecap(firebase: FirebaseHelper, userId: string, game: DondGame, components?: unknown[]) {
  const chat = await readChat(firebase, userId)
  await announce({ embeds: [recapEmbed(userId, game, chat)], allowed_mentions: { parse: [] }, ...(components ? { components } : {}) }, game.channelId)
}

const err = (message: string, status = 400) => Response.json({ error: message }, { status })

export async function getDondStatus(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const game = await readGame(firebase, user.id)
  return Response.json({
    tokens: tokensOf(dbUser),
    game: game ? publicView(game) : null,
    hostId: user.id,
    chat: game ? (await readChat(firebase, user.id)).slice(-CHAT_VISIBLE) : [],
    spectators: game ? await readSpectators(firebase, user.id) : [],
  })
}

export async function startDond(user: AuthenticatedDiscordUser, tierInput: unknown, caseInput: unknown, channelInput?: unknown) {
  const firebase = new FirebaseHelper()
  const tier = TIERS.find((t) => t === tierInput)
  const playerCase = Math.floor(Number(caseInput))
  if (!tier) return err("Ugyldig nivå")
  if (!(playerCase >= 1 && playerCase <= NUM_CASES)) return err(`Velg en koffert mellom 1 og ${NUM_CASES}`)

  const existing = await readGame(firebase, user.id)
  if (existing && existing.state !== "done") return err("Du har allerede et aktivt spill")

  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const tokens = tokensOf(dbUser)
  if (tokens[tier] <= 0) return err(`Du har ingen ${DOND_TIER_K[tier]}K-token`)

  await firebase.updateUserFields(user.id, { [`dondTokens/${tier}`]: tokens[tier] - 1 })
  const game: DondGame = {
    tier,
    values: shuffle(DOND_CASES[tier]),
    opened: new Array(NUM_CASES).fill(false),
    playerCase,
    startCase: playerCase,
    round: 1,
    casesOpened: 0,
    state: "opening",
    playerName: user.globalName ?? user.username,
    channelId: await resolveAnnounceChannel(typeof channelInput === "string" ? channelInput : null),
  }
  await writeGame(firebase, user.id, game)
  // A fresh round never inherits the previous round's chat.
  await firebase.updateData({ [chatPath(user.id)]: null, [spectatorsPath(user.id)]: null })
  await announce({ content: `<@${user.id}> har startet en runde Deal or No Deal! Klikk på knappen for å se på`, components: [dondSpectateButtonComponent(user.id)] }, game.channelId)
  return Response.json({ tokens: { ...tokens, [tier]: tokens[tier] - 1 }, game: publicView(game) })
}

export async function openDondCase(user: AuthenticatedDiscordUser, caseInput: unknown) {
  const firebase = new FirebaseHelper()
  const game = await readGame(firebase, user.id)
  if (!game || game.state !== "opening") return err("Ingen koffert å åpne akkurat nå")

  const nr = Math.floor(Number(caseInput))
  if (!(nr >= 1 && nr <= NUM_CASES) || nr === game.playerCase || game.opened[nr - 1]) return err("Kan ikke åpne den kofferten")

  game.opened[nr - 1] = true
  game.casesOpened++
  if (game.casesOpened >= casesOpenedByEndOfRound(game.round)) {
    game.state = "offer"
    game.offer = computeOffer(game)
  }
  await writeGame(firebase, user.id, game)
  return Response.json({ game: publicView(game) })
}

export async function answerDondOffer(user: AuthenticatedDiscordUser, deal: boolean) {
  const firebase = new FirebaseHelper()
  const game = await readGame(firebase, user.id)
  if (!game || game.state !== "offer" || !game.offer) return err("Ingen tilbud å svare på")

  if (!deal) {
    game.round++
    game.state = game.round < MAX_ROUNDS ? "opening" : "keepOrSwitch"
    delete game.offer
    await writeGame(firebase, user.id, game)
    return Response.json({ game: publicView(game) })
  }

  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const playerCaseValue = game.values[game.playerCase - 1]
  const otherCaseValue = game.values.find((_, i) => !game.opened[i] && i + 1 !== game.playerCase)
  const offer = game.offer
  const updates: Record<string, unknown> = {}
  let recapComponents: unknown[] | undefined

  if (offer.kind === "chips") {
    const paid = jailAdjusted(dbUser, offer.amount)
    updates.chips = (dbUser.chips ?? 0) + paid
    updates["userStats/dondStats"] = updatedStats(dbUser, game.tier, offer.amount, playerCaseValue, { fromDeal: true })
    game.result = { outcome: "deal", chips: paid, playerCaseValue, otherCaseValue }
  } else {
    const effect = findEffect(offer.id) as DondEffect
    Object.assign(updates, effect.apply(dbUser))
    updates["userStats/dondStats"] = updatedStats(dbUser, game.tier, 0, playerCaseValue, { acceptedEffect: true })
    game.result = { outcome: "deal", effectLabel: effect.label, playerCaseValue, otherCaseValue }

    if (effect.potAdd) {
      await firebase.addToDeathrollPot(effect.potAdd)
    }
    if (effect.loot) recapComponents = [lootButtonComponent(user.id, effect.loot.quality, effect.loot.type)]
  }

  await firebase.updateUserFields(user.id, updates)
  game.state = "done"
  delete game.offer
  await writeGame(firebase, user.id, game)
  await postRecap(firebase, user.id, game, recapComponents)
  return Response.json({ game: publicView(game) })
}

export async function keepOrSwitchDond(user: AuthenticatedDiscordUser, doSwitch: boolean) {
  const firebase = new FirebaseHelper()
  const game = await readGame(firebase, user.id)
  if (!game || game.state !== "keepOrSwitch") return err("Ingenting å velge akkurat nå")

  const otherNr = game.values.map((_, i) => i + 1).find((nr) => !game.opened[nr - 1] && nr !== game.playerCase) as number
  const otherValue = game.values[otherNr - 1]
  const originalValue = game.values[game.playerCase - 1]

  // Mirrors the bot: "remaining" is the case you did NOT end up with.
  const won = doSwitch ? otherValue : originalValue
  const remaining = doSwitch ? originalValue : otherValue
  if (doSwitch) game.playerCase = otherNr

  const dbUser = (await firebase.getUser(user.id)) ?? {}
  const paid = jailAdjusted(dbUser, won)
  await firebase.updateUserFields(user.id, {
    chips: (dbUser.chips ?? 0) + paid,
    "userStats/dondStats": updatedStats(dbUser, game.tier, won, won, { remainingCaseValue: remaining, keptCase: !doSwitch }),
  })

  game.state = "done"
  game.result = { outcome: doSwitch ? "switched" : "kept", chips: paid, playerCaseValue: won, otherCaseValue: remaining }
  await writeGame(firebase, user.id, game)
  await postRecap(firebase, user.id, game)
  return Response.json({ game: publicView(game) })
}

/** Clears a finished game so the lobby screen shows again. An unfinished game can't be dropped - the token is already spent. */
export async function dismissDond(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const game = await readGame(firebase, user.id)
  if (game && game.state === "done") await firebase.updateData({ [gamePath(user.id)]: null, [chatPath(user.id)]: null, [spectatorsPath(user.id)]: null })
  return getDondStatus(user)
}

/** Read-only view of someone else's round - same masked view the player gets, so closed cases stay hidden. */
export async function getDondWatch(hostId: string, viewer: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  // Polling doubles as the "I'm watching" heartbeat the player's screen shows.
  if (viewer.id !== hostId) {
    await firebase.updateData({ [`${spectatorsPath(hostId)}/${viewer.id}`]: { name: viewer.globalName ?? viewer.username, avatar: viewer.avatar ?? null, at: Date.now() } })
  }
  const game = await readGame(firebase, hostId)
  return Response.json({
    playerName: game?.playerName ?? null,
    game: game ? publicView(game) : null,
    hostId,
    chat: game ? (await readChat(firebase, hostId)).slice(-CHAT_VISIBLE) : [],
    spectators: game ? await readSpectators(firebase, hostId) : [],
  })
}

/** The bot's DOND_SPECTATE button writes other/pendingDondSpectate/{clickerId} right before launching the
 * Activity (which can only open at the root page - no deep links), and the hub calls this to find out where to go. */
export async function consumePendingDondSpectate(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const pending = await firebase.getData(`other/pendingDondSpectate/${user.id}`)
  if (!pending) return Response.json({ hostId: null })
  await firebase.updateData({ [`other/pendingDondSpectate/${user.id}`]: null })
  const fresh = typeof pending.createdAt === "number" && Date.now() - pending.createdAt < 10 * 60 * 1000
  return Response.json({ hostId: fresh && pending.hostId ? String(pending.hostId) : null })
}
