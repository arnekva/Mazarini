"use client"

import { BlackjackGame } from "@/components/BlackjackGame"
import { PageShell } from "@/components/PageShell"
import { useDiscord } from "@/providers/discordProvider"

export default function BlackjackPage() {
  const { accessToken } = useDiscord()
  return <PageShell title="Blackjack">{accessToken ? <BlackjackGame accessToken={accessToken} /> : <p>Laster...</p>}</PageShell>
}
