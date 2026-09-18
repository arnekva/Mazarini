"use client"

import { MastermindGame } from "@/components/MastermindGame"
import { PageShell } from "@/components/PageShell"
import { useDiscord } from "@/providers/discordProvider"

export default function MastermindPage() {
  const { accessToken } = useDiscord()
  return <PageShell title="Mastermind">{accessToken ? <MastermindGame accessToken={accessToken} /> : <p>Laster...</p>}</PageShell>
}
