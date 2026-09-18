"use client"

import { MoreOrLessGame } from "@/components/MoreOrLessGame"
import { PageShell } from "@/components/PageShell"
import { useDiscord } from "@/providers/discordProvider"

export default function MoreOrLessPage() {
  const { accessToken } = useDiscord()
  return <PageShell title="More or Less">{accessToken ? <MoreOrLessGame accessToken={accessToken} /> : <p>Laster...</p>}</PageShell>
}
