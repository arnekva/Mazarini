"use client"

import { PageShell } from "@/components/PageShell"
import { RedBlackGame } from "@/components/RedBlackGame"
import { useDiscord } from "@/providers/discordProvider"

export default function RedBlackPage() {
  const { accessToken } = useDiscord()
  return <PageShell title="Rød / Svart">{accessToken ? <RedBlackGame accessToken={accessToken} /> : <p>Laster...</p>}</PageShell>
}
