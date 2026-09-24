"use client"

import { proxyImageUrl } from "@/lib/imgProxy"
import styles from "./SpectatorBar.module.css"

export interface Spectator {
  id: string
  username: string
  /** A ready-to-use avatar URL (see discordAvatarUrl on the server). */
  avatar: string
}

/** How many names fit in the label before it falls back to a count - the avatars (with the names as tooltips) are always there. */
const MAX_NAMES_IN_LABEL = 3

/** "👁 Bob, Dana ser på" plus greyed-out avatars - the one way every game shows who's watching but not playing. Renders nothing when there's no one. */
export function SpectatorBar({ spectators }: { spectators: Spectator[] }) {
  if (spectators.length === 0) return null
  const label = spectators.length <= MAX_NAMES_IN_LABEL ? spectators.map((s) => s.username).join(", ") : String(spectators.length)

  return (
    <div className={styles.bar}>
      <span className={styles.label}>👁 {label} ser på</span>
      {spectators.map((s) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={s.id} className={styles.avatar} src={proxyImageUrl(s.avatar)} alt={s.username} title={s.username} />
      ))}
    </div>
  )
}
