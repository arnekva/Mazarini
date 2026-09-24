"use client"

import { PageShell } from "@/components/PageShell"
import { RouletteGame } from "@/components/RouletteGame"
import { useDiscord } from "@/providers/discordProvider"

export default function RoulettePage() {
  const { accessToken } = useDiscord()
  return <PageShell title="Rulett">{accessToken ? <RouletteGame accessToken={accessToken} /> : <p>Laster...</p>}</PageShell>
}
