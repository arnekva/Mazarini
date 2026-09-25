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
    homeGuildId ??= await guildOfChannel(ANNOUNCE_CHANNEL_ID)
    const guild = await guildOfChannel(requested)
    return guild && guild === homeGuildId ? requested : ANNOUNCE_CHANNEL_ID
  } catch {
    return ANNOUNCE_CHANNEL_ID
  }
}
