"use client"

import { DondGame } from "@/components/DondGame"
import { PageShell } from "@/components/PageShell"
import { useDiscord } from "@/providers/discordProvider"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function DondContent() {
  const { accessToken } = useDiscord()
  // ?watch=<userId> = spectate that user's round (set by the hub after a "Se på" button click)
  const watchId = useSearchParams().get("watch") ?? undefined
  return accessToken ? <DondGame key={watchId ?? "me"} accessToken={accessToken} watchId={watchId} /> : <p>Laster...</p>
}

export default function DondPage() {
  return (
    <PageShell title="Deal or No Deal">
      <Suspense fallback={<p>Laster...</p>}>
        <DondContent />
      </Suspense>
    </PageShell>
  )
}
