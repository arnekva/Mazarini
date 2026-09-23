"use client"

import { DiscordSDK } from "@discord/embedded-app-sdk"
import React, { createContext, useContext, useEffect, useState } from "react"

interface DiscordUser {
  id: string
  username: string
  global_name?: string | null
  avatar: string | null
}

interface DiscordContextType {
  sdk: DiscordSDK | null
  discordUser: DiscordUser | null
  accessToken: string | null
  ready: boolean
  /** Shared by everyone who launched this Activity from the same voice channel - the natural
   * multiplayer "room" key. Null outside Discord (e.g. local dev in a plain browser tab). */
  instanceId: string | null
}

const DiscordContext = createContext<DiscordContextType>({
  sdk: null,
  discordUser: null,
  accessToken: null,
  ready: false,
  instanceId: null,
})

export const DiscordProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sdk, setSdk] = useState<DiscordSDK | null>(null)
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [instanceId, setInstanceId] = useState<string | null>(null)

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID as string

    // Local testing without Discord (see devAuthEnabled in lib/env.ts). Open with ?devUser=<discordId>[:<name>]
    // to act as a specific user - a different one per browser tab makes multiplayer testable alone.
    // Remembered per tab, so in-app navigation keeps the same user.
    if (process.env.NEXT_PUBLIC_DEV_AUTH === "1" && process.env.NODE_ENV !== "production") {
      let spec = new URLSearchParams(window.location.search).get("devUser")
      try {
        if (spec) sessionStorage.setItem("devUser", spec)
        else spec = sessionStorage.getItem("devUser")
      } catch {
        // sessionStorage blocked - falls back to the default user below
      }
      const [id, ...rest] = (spec || "dev-user-1").split(":")
      const name = rest.join(":") || id
      setAccessToken(`dev:${id}:${name}`)
      setDiscordUser({ id, username: name, global_name: name, avatar: null })
      setInstanceId("dev-instance")
      setReady(true)
      return
    }

    if (!clientId) {
      setReady(true)
      return
    }

    async function setupDiscordSdk() {
      const discordSdk = new DiscordSDK(clientId)
      await discordSdk.ready()

      const { code } = await discordSdk.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify"],
      })

      const response = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const { access_token } = await response.json()

      const auth = await discordSdk.commands.authenticate({ access_token })
      if (!auth) throw new Error("Authenticate command failed")

      setAccessToken(access_token)
      setDiscordUser(auth.user as DiscordUser)
      setSdk(discordSdk)
      setInstanceId(discordSdk.instanceId)
      setReady(true)
    }

    setupDiscordSdk().catch((err) => {
      console.error("Discord SDK setup failed", err)
      setReady(true)
    })
  }, [])

  return (
    <DiscordContext.Provider value={{ sdk, discordUser, accessToken, ready, instanceId }}>{children}</DiscordContext.Provider>
  )
}

export function useDiscord() {
  return useContext(DiscordContext)
}
