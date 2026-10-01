"use client"

import { AdminDailyGift } from "@/components/AdminDailyGift"
import { PageShell } from "@/components/PageShell"
import { isAdminUser } from "@/lib/admin"
import { useDiscord } from "@/providers/discordProvider"

/** Admin-only controls. Hidden from everyone else here, and every admin API route checks the caller again on the server. */
export default function AdminPage() {
  const { accessToken, discordUser, ready } = useDiscord()

  if (!ready) return <PageShell title="Admin">Laster...</PageShell>
  if (!accessToken || !isAdminUser(discordUser?.id)) return <PageShell title="Admin">Denne siden er bare for admin.</PageShell>

  return (
    <PageShell title="Admin">
      <AdminDailyGift accessToken={accessToken} myId={discordUser?.id} />
    </PageShell>
  )
}
