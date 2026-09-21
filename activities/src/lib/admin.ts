// Gate for power-user-only features (Song Rank's Spotify write-access, etc.) that aren't meant for
// every Discord server member who opens the daily hub.
export const ADMIN_DISCORD_ID = "245607554254766081"

export function isAdminUser(discordUserId: string | undefined | null): boolean {
  return discordUserId === ADMIN_DISCORD_ID
}
