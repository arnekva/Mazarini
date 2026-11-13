import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"

// "Bli med" / "Se på" buttons under the message posted when someone starts a multiplayer table - same idea as Deal or No Deal's
// "Se på". The Activity can only open at its root page, so the bot's MP_INVITE handler (commands/games/blackjack.ts) records what
// the clicker wanted in other/pendingMultiplayerInvite/{clickerId} and launches it, and the hub forwards them to that table.

export type InviteGame = "blackjack" | "electricity" | "redblack"
export type InviteMode = "join" | "watch"

const GAMES: InviteGame[] = ["blackjack", "electricity", "redblack"]

/** The custom_id is parsed by the bot: MP_INVITE;{hostId};{game};{mode}. */
export function inviteButtonsComponent(game: InviteGame, hostId: string) {
  return {
    type: 1,
    components: [
      { type: 2, style: 3, label: "🃏 Bli med", custom_id: `MP_INVITE;${hostId};${game};join` },
      { type: 2, style: 1, label: "👁 Se på", custom_id: `MP_INVITE;${hostId};${game};watch` },
    ],
  }
}

/** Consumed on read; a stale one (older than 10 minutes) is ignored. */
export async function consumePendingMultiplayerInvite(user: AuthenticatedDiscordUser) {
  const firebase = new FirebaseHelper()
  const path = `other/pendingMultiplayerInvite/${user.id}`
  const pending = await firebase.getData(path)
  if (!pending) return Response.json({ invite: null })
  await firebase.updateData({ [path]: null })
  const fresh = typeof pending.createdAt === "number" && Date.now() - pending.createdAt < 10 * 60 * 1000
  const game = GAMES.find((g) => g === pending.game)
  if (!fresh || !game || !pending.hostId) return Response.json({ invite: null })
  return Response.json({ invite: { game, hostId: String(pending.hostId), mode: pending.mode === "join" ? "join" : "watch" } })
}
