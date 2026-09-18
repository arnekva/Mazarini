"use client"

import { DailyClaimGame } from "@/components/DailyClaimGame"
import { PageShell } from "@/components/PageShell"
import { useDiscord } from "@/providers/discordProvider"

export default function DailyClaimPage() {
  const { accessToken } = useDiscord()
  return <PageShell title="Daily claim">{accessToken ? <DailyClaimGame accessToken={accessToken} /> : <p>Laster...</p>}</PageShell>
}
