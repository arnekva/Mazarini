"use client"

import { CountryGuessGame } from "@/components/CountryGuessGame"
import { PageShell } from "@/components/PageShell"
import { useDiscord } from "@/providers/discordProvider"

export default function FlagPage() {
  const { accessToken } = useDiscord()
  return <PageShell title="Gjett flagget">{accessToken ? <CountryGuessGame game="flag" accessToken={accessToken} /> : <p>Laster...</p>}</PageShell>
}
