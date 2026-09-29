"use client"

import { callApi } from "@/lib/apiClient"
import { useEffect, useRef, useState } from "react"
import styles from "./GameChat.module.css"

export interface ChatMessage {
  userId: string
  name: string
  text: string
  at: number
}

/** Chat for a multiplayer table: a scrollable log (sticks to the bottom unless you've scrolled up to read) and an input. The messages
 * come with the table's own polling - `onPosted` hands back what the server answers to a sent message so it shows up at once. */
export function GameChat({
  messages,
  boldUserId,
  post,
  onPosted,
}: {
  messages: ChatMessage[]
  /** Whose lines are bold (the table's host / the player of the round). */
  boldUserId?: string
  /** Sends a chat message with the game's own endpoint and returns the updated chat. */
  post: (text: string) => Promise<{ chat: ChatMessage[] }>
  onPosted: (chat: ChatMessage[]) => void
}) {
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  useEffect(() => {
    const el = logRef.current
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages.length])

  async function send() {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    try {
      onPosted((await post(text)).chat)
      setDraft("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.chat}>
      <div
        ref={logRef}
        className={styles.chatLog}
        onScroll={() => {
          const el = logRef.current
          if (el) stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
      >
        {messages.length === 0 && <span className={styles.chatEmpty}>Ingen meldinger ennå</span>}
        {messages.map((m, i) => (
          <div key={`${m.at}-${i}`} className={styles.chatLine}>
            {m.userId === boldUserId ? <strong>{m.name}</strong> : m.name}: {m.text}
          </div>
        ))}
      </div>
      <form
        className={styles.chatForm}
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input className={styles.chatInput} value={draft} maxLength={200} placeholder="Skriv en melding..." onChange={(e) => setDraft(e.target.value)} />
        <button className={styles.chatSend} type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
      {error && <p style={{ color: "var(--red, #e5484d)", fontSize: 12, margin: 0 }}>{error}</p>}
    </div>
  )
}

/** Helper for the games' own `post` callbacks. */
export const postChatTo = (path: string, accessToken: string, body: Record<string, unknown>) =>
  callApi<{ chat: ChatMessage[] }>(path, accessToken, { method: "POST", body: JSON.stringify(body) })
