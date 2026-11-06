// Gate for power-user-only features (Song Rank's Spotify write-access, etc.) that aren't meant for
// every Discord server member who opens the daily hub.
export const ADMIN_DISCORD_ID = "245607554254766081"

export function isAdminUser(discordUserId: string | undefined | null): boolean {
  return discordUserId === ADMIN_DISCORD_ID
}

/** Who can open /admin and pick the daily gift. Song Rank and the rest stay with isAdminUser. */
const GIFT_ADMIN_IDS = [ADMIN_DISCORD_ID, "397429060898390016"]

export function canManageGifts(discordUserId: string | undefined | null): boolean {
  return !!discordUserId && GIFT_ADMIN_IDS.includes(discordUserId)
}
