import { discordBotToken } from "./env"

// Raw Discord REST calls using the bot token - same identity the bot itself posts as, so a button
// posted from here is handled by the bot's already-registered OPEN_LOOT interaction handler.
export async function postChannelMessage(channelId: string, body: { content?: string; components?: unknown[] }) {
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${discordBotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
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
