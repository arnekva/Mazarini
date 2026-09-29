import { FirebaseHelper } from "./db/firebaseHelper"
import { AuthenticatedDiscordUser } from "./discordAuth"

// In-game chat shared by the multiplayer games (Deal or No Deal has its own older copy). One Firebase child per message
// (unique key) under a path of the game's choosing, separate from the game record - a chat write can never clobber a game
// action's read-modify-write of the game, or the other way around.

export interface ChatMessage {
  userId: string
  name: string
  text: string
  at: number
}

export const CHAT_MAX_LENGTH = 200
const CHAT_MAX_MESSAGES = 500
export const CHAT_VISIBLE = 100

export async function readChat(firebase: FirebaseHelper, path: string): Promise<ChatMessage[]> {
  const raw = await firebase.getData(path)
  if (!raw) return []
  return (Object.values(raw) as ChatMessage[]).sort((a, b) => a.at - b.at)
}

/** Appends a message; returns the visible tail of the chat, or an error to show the sender. */
export async function postChat(
  firebase: FirebaseHelper,
  path: string,
  user: AuthenticatedDiscordUser,
  textInput: unknown
): Promise<{ chat: ChatMessage[] } | { error: string }> {
  const text = String(textInput ?? "").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX_LENGTH)
  if (!text) return { error: "Skriv noe først" }
  const chat = await readChat(firebase, path)
  if (chat.length >= CHAT_MAX_MESSAGES) return { error: "Chatten er full" }

  const message: ChatMessage = { userId: user.id, name: user.globalName ?? user.username, text, at: Date.now() }
  await firebase.updateData({ [`${path}/${message.at}-${Math.random().toString(36).slice(2, 6)}`]: message })
  return { chat: [...chat, message].slice(-CHAT_VISIBLE) }
}

/** The chat as embed fields (a field value caps at 1024 characters). `boldUserId`'s lines are bold, like in the Activity. The newest
 * lines win when the chat is longer than `budget` characters; the oldest are then summarised as omitted. */
export function chatEmbedFields(chat: ChatMessage[], boldUserId?: string, budget = 1800): { name: string; value: string }[] {
  const lines = chat.map((m) => (m.userId === boldUserId ? `**${m.name}**: ${m.text}` : `${m.name}: ${m.text}`))
  const kept: string[] = []
  let left = budget
  let dropped = 0
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].length + 1 > left) {
      dropped = i + 1
      break
    }
    left -= lines[i].length + 1
    kept.unshift(lines[i])
  }

  const fields: { name: string; value: string }[] = []
  let chunk: string[] = []
  let size = 0
  const flush = () => {
    if (chunk.length === 0) return
    fields.push({ name: fields.length === 0 ? "💬 Chat" : "​", value: chunk.join("\n") })
    chunk = []
    size = 0
  }
  for (const line of kept) {
    if (size + line.length + 1 > 1000) flush()
    chunk.push(line.slice(0, 1000))
    size += line.length + 1
  }
  flush()
  if (dropped > 0 && fields.length > 0) fields[0].value = `*(${dropped} eldre meldinger utelatt)*\n${fields[0].value}`
  return fields
}
