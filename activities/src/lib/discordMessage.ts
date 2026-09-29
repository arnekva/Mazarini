import { devAuthEnabled, discordBotToken } from "./env"
import { ANNOUNCE_CHANNEL_ID } from "./gameValues"

// Raw Discord REST calls using the bot token - same identity the bot itself posts as, so a button
// posted from here is handled by the bot's already-registered OPEN_LOOT interaction handler.
/** Returns whether Discord accepted the message - callers that have somewhere else to try (see resolveAnnounceChannel) can fall back. */
export async function postChannelMessage(channelId: string, body: { content?: string; components?: unknown[]; embeds?: unknown[]; allowed_mentions?: unknown }): Promise<boolean> {
  if (devAuthEnabled) {
    console.log("[dev] skipped Discord post to", channelId, body.content ?? "", body.embeds ? JSON.stringify(body.embeds, null, 2) : "")
    return true
  }
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${discordBotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) console.warn(`Discord post to ${channelId} failed (${response.status}):`, await response.text().catch(() => ""))
  return response.ok
}

/** Same shape as LootboxCommands.getLootRewardButton in the bot repo - the bot's OPEN_LOOT handler parses this custom_id. */
export function lootButtonComponent(userId: string, quality: string, type: "chest" | "box", series = "") {
  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 1,
        label: `Open loot ${type}`,
        custom_id: `OPEN_LOOT;${userId};${quality};${type};${series}`,
      },
    ],
  }
}

/** "Se på" button under a Deal or No Deal announcement - the bot's DOND_SPECTATE handler (commands/games/dealOrNoDeal.ts)
 * records who to watch, then opens the Activity, and the hub forwards the spectator to that round. */
export function dondSpectateButtonComponent(playerId: string) {
  return {
    type: 1,
    components: [{ type: 2, style: 1, label: "👁 Se på", custom_id: `DOND_SPECTATE;${playerId}` }],
  }
}

async function guildOfChannel(channelId: string): Promise<string | null> {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers: { Authorization: `Bot ${discordBotToken}` } })
  if (!response.ok) return null
  return ((await response.json()) as { guild_id?: string }).guild_id ?? null
}

let homeGuildId: string | null | undefined

/** Where an announcement about something started in a given channel should go: that channel, if it's usable - and otherwise the default
 * announce channel. `requested` comes from the client (the channel the Activity was launched in), so it isn't trusted blindly: it has to be a
 * real channel the bot can see, in the same server as the default one, or it's ignored. */
export async function resolveAnnounceChannel(requested?: string | null): Promise<string> {
  if (!requested || requested === ANNOUNCE_CHANNEL_ID || !/^\d{17,20}$/.test(requested)) return ANNOUNCE_CHANNEL_ID
  if (devAuthEnabled) return requested // nothing is posted in dev mode anyway
  try {
    const guild = await guildOfChannel(requested)
    if (!guild) {
      console.warn(`Announce channel ${requested} isn't visible to the bot - using the default channel`)
      return ANNOUNCE_CHANNEL_ID
    }
    homeGuildId ??= await guildOfChannel(ANNOUNCE_CHANNEL_ID)
    // If the default channel's server can't be determined, a channel the bot can see is good enough - better than always falling back.
    if (homeGuildId && guild !== homeGuildId) {
      console.warn(`Announce channel ${requested} is in another server - using the default channel`)
      return ANNOUNCE_CHANNEL_ID
    }
    return requested
  } catch (e) {
    console.warn("Resolving the announce channel failed - using the default channel", e)
    return ANNOUNCE_CHANNEL_ID
  }
}

/** Posts to an already-resolved channel (see resolveAnnounceChannel), falling back to the default one if the bot can't post there. Best-effort: never throws. */
export async function postAnnouncement(target: string, body: Parameters<typeof postChannelMessage>[1]) {
  try {
    if (!(await postChannelMessage(target, body)) && target !== ANNOUNCE_CHANNEL_ID) await postChannelMessage(ANNOUNCE_CHANNEL_ID, body)
  } catch (e) {
    console.error("Discord announcement failed", e)
  }
}

/** Announces in the channel the Activity was launched from (`requested`, straight from the client - validated here), else the default channel. */
export async function announceInChannel(requested: string | null | undefined, body: Parameters<typeof postChannelMessage>[1]) {
  await postAnnouncement(await resolveAnnounceChannel(requested), body)
}

// ---------- a message that's edited as a game goes on ----------
//
// Serverless: nothing runs once the players' connections drop, so a "game over" summary can't be trusted to get sent. Instead the
// game posts one message when it starts and edits it every time something worth recording happens - whatever is on screen in
// Discord is then always current, no matter how the game ended.

export interface LiveMessageRef {
  channelId: string
  messageId: string
}

type MessageBody = Parameters<typeof postChannelMessage>[1]

/** Posts a message and returns where it ended up (the launch channel, or the default one if the bot can't post there) so it can be edited later. */
export async function postLiveMessage(target: string, body: MessageBody): Promise<LiveMessageRef | null> {
  const send = async (channelId: string): Promise<LiveMessageRef | null> => {
    if (devAuthEnabled) {
      console.log("[dev] skipped live Discord post to", channelId, JSON.stringify(body.embeds ?? body.content, null, 2))
      return { channelId, messageId: "dev" }
    }
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${discordBotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      console.warn(`Discord post to ${channelId} failed (${response.status}):`, await response.text().catch(() => ""))
      return null
    }
    return { channelId, messageId: ((await response.json()) as { id: string }).id }
  }
  try {
    return (await send(target)) ?? (target !== ANNOUNCE_CHANNEL_ID ? await send(ANNOUNCE_CHANNEL_ID) : null)
  } catch (e) {
    console.error("Discord live post failed", e)
    return null
  }
}

/** Best-effort edit of a message from postLiveMessage. */
export async function editLiveMessage(ref: LiveMessageRef, body: MessageBody) {
  if (devAuthEnabled) {
    console.log("[dev] skipped live Discord edit of", ref.messageId, JSON.stringify(body.embeds ?? body.content, null, 2))
    return
  }
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${ref.channelId}/messages/${ref.messageId}`, {
      method: "PATCH",
      headers: { Authorization: `Bot ${discordBotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) console.warn(`Discord edit of ${ref.messageId} failed (${response.status}):`, await response.text().catch(() => ""))
  } catch (e) {
    console.error("Discord live edit failed", e)
  }
}

/** The running record of a game as an embed: `rounds` (one entry per finished round, oldest first - the newest survive if they don't all fit),
 * then the chat. Mentions inside never ping (send it with allowed_mentions.parse = []). */
export function liveLogBody(
  title: string,
  intro: string,
  rounds: string[],
  chatFields: { name: string; value: string }[],
  footer?: string
): MessageBody {
  const kept: string[] = []
  let budget = 3400
  let dropped = 0
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].length + 2 > budget) {
      dropped = i + 1
      break
    }
    budget -= rounds[i].length + 2
    kept.unshift(rounds[i])
  }
  const description = [intro, ...(dropped > 0 ? [`*(${dropped} eldre runder utelatt)*`] : []), ...kept].join("\n\n")
  return { embeds: [{ title, description, ...(chatFields.length > 0 ? { fields: chatFields } : {}), ...(footer ? { footer: { text: footer } } : {}) }], allowed_mentions: { parse: [] } }
}
