/** Builds a Discord CDN avatar URL for a user - their real avatar if they have one, otherwise
 * Discord's own default avatar for that account (the modern per-user-id formula, not the old
 * per-discriminator one, since new accounts don't have a meaningful discriminator anymore). */
export function discordAvatarUrl(userId: string, avatar: string | null, size = 64): string {
  if (avatar) return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=${size}`
  // Real Discord ids are numeric snowflakes; the local dev-auth users (see lib/env.ts) may not be.
  const defaultIndex = /^\d+$/.test(userId) ? Number((BigInt(userId) >> BigInt(22)) % BigInt(6)) : 0
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`
}
