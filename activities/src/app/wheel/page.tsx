"use client"

import { PageShell } from "@/components/PageShell"
import { WheelGame } from "@/components/WheelGame"
import { useDiscord } from "@/providers/discordProvider"

export default function WheelPage() {
  const { accessToken } = useDiscord()
  return <PageShell title="Lykkehjul">{accessToken ? <WheelGame accessToken={accessToken} /> : <p>Laster...</p>}</PageShell>
}
