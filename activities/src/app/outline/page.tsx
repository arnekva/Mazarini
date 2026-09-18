"use client"

import { CountryGuessGame } from "@/components/CountryGuessGame"
import { PageShell } from "@/components/PageShell"
import { useDiscord } from "@/providers/discordProvider"

export default function OutlinePage() {
  const { accessToken } = useDiscord()
  return (
    <PageShell title="Gjett landet fra outline">
      {accessToken ? <CountryGuessGame game="outline" accessToken={accessToken} /> : <p>Laster...</p>}
    </PageShell>
  )
}
