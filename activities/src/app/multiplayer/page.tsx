"use client"

import Link from "next/link"
import { PageShell } from "@/components/PageShell"
import homeStyles from "../page.module.css"

const multiplayerGames = [
  { id: "blackjack", label: "Blackjack", cardClass: "cardGreen" },
  { id: "electricity", label: "Electricity ⚡", cardClass: "cardGold" },
  { id: "redblack", label: "Rød / Svart", cardClass: "cardRed" },
]

export default function MultiplayerPage() {
  return (
    <PageShell title="Multiplayer">
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
        Alle som åpner denne Activity-en fra samme talekanal havner ved samme bord.
      </p>
      <div className={homeStyles.section}>
        {multiplayerGames.map((g) => (
          <Link key={g.id} className={`${homeStyles.card} ${homeStyles[g.cardClass]}`} style={{ width: "100%", display: "block" }} href={`/multiplayer/${g.id}`}>
            {g.label}
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
