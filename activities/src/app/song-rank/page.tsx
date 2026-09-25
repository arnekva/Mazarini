"use client"

import { PageShell } from "@/components/PageShell"
import { SongRankGame } from "@/components/SongRankGame"
import { isAdminUser } from "@/lib/admin"
import { useDiscord } from "@/providers/discordProvider"

export default function SongRankPage() {
  const { discordUser, accessToken, ready } = useDiscord()

  if (!ready) return <PageShell title="Song Rank"><p>Laster...</p></PageShell>
  if (!isAdminUser(discordUser?.id)) return <PageShell title="Song Rank"><p>Denne siden er ikke tilgjengelig.</p></PageShell>

  return (
    <PageShell title="Song Rank">
      <SongRankGame accessToken={accessToken} />
    </PageShell>
  )
}
