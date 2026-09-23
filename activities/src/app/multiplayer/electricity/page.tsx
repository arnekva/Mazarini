"use client"

import { ElectricityGame } from "@/components/ElectricityGame"
import { PageShell } from "@/components/PageShell"
import { useDiscord } from "@/providers/discordProvider"

export default function ElectricityPage() {
  const { accessToken } = useDiscord()
  return <PageShell title="Electricity ⚡">{accessToken ? <ElectricityGame accessToken={accessToken} /> : <p>Laster...</p>}</PageShell>
}
