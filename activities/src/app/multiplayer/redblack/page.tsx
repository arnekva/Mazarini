"use client"

import { PageShell } from "@/components/PageShell"
import { RedBlackGame } from "@/components/RedBlackGame"
import { useDiscord } from "@/providers/discordProvider"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function RedBlackContent() {
  const { accessToken } = useDiscord()
  // ?invite=<hostId>&mode=join|watch = set by the hub after a "Bli med" / "Se på" click under a new table's announcement
  const params = useSearchParams()
  const inviteHostId = params.get("invite")
  const invite = inviteHostId ? { hostId: inviteHostId, mode: params.get("mode") === "join" ? ("join" as const) : ("watch" as const) } : undefined
  return accessToken ? <RedBlackGame accessToken={accessToken} invite={invite} /> : <p>Laster...</p>
}

export default function RedBlackPage() {
  return (
    <PageShell title="Rød / Svart">
      <Suspense fallback={<p>Laster...</p>}>
        <RedBlackContent />
      </Suspense>
    </PageShell>
  )
}
