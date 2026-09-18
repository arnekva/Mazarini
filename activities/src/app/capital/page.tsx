"use client"

import { CountryGuessGame } from "@/components/CountryGuessGame"
import { PageShell } from "@/components/PageShell"
import { useDiscord } from "@/providers/discordProvider"

export default function CapitalPage() {
  const { accessToken } = useDiscord()
  return <PageShell title="Si hovedstaden">{accessToken ? <CountryGuessGame game="capital" accessToken={accessToken} /> : <p>Laster...</p>}</PageShell>
}
