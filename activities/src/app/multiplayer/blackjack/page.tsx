"use client"

import { BlackjackGame } from "@/components/BlackjackGame"
import { PageShell } from "@/components/PageShell"
import { useDiscord } from "@/providers/discordProvider"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function BlackjackContent() {
  const { accessToken } = useDiscord()
  // ?watch=<userId> = go and watch that user's table as soon as it's up (set by the hub after someone else clicks a pot-win "Spill Blackjack" button)
  const params = useSearchParams()
  const watchHostId = params.get("watch") ?? undefined
  // ?invite=<hostId>&mode=join|watch = set by the hub after a "Bli med" / "Se på" click under a new table's announcement
  const inviteHostId = params.get("invite")
  const invite = inviteHostId ? { hostId: inviteHostId, mode: params.get("mode") === "join" ? ("join" as const) : ("watch" as const) } : undefined
  return accessToken ? <BlackjackGame accessToken={accessToken} watchHostId={watchHostId} invite={invite} /> : <p>Laster...</p>
}

export default function BlackjackPage() {
  return (
    <PageShell title="Blackjack">
      <Suspense fallback={<p>Laster...</p>}>
        <BlackjackContent />
      </Suspense>
    </PageShell>
  )
}
