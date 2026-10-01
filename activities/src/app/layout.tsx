import { DiscordProvider } from "@/providers/discordProvider"
import { ThemeDecor } from "@/themes/ThemeDecor"
import { ThemeOverride } from "@/themes/ThemeOverride"
import { activeTheme } from "@/themes/themes"
import type { Metadata, Viewport } from "next"
import { connection } from "next/server"
import "./globals.css"
import "@/themes/shared/shared.css"
import "@/themes/shared/light.css"

export const metadata: Metadata = {
  title: "Daily",
  description: "Mazarini daily hub",
}

export const viewport: Viewport = {
  viewportFit: "cover",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The theme depends on today's date, so this has to be rendered per request - built once, it'd keep the theme of the build day.
  await connection()
  const theme = activeTheme()

  return (
    // suppressHydrationWarning: ThemeOverride may change data-theme on the client.
    <html lang="en" data-theme={theme?.id} data-tone={theme?.tone} suppressHydrationWarning>
      <body>
        <ThemeDecor />
        <ThemeOverride />
        <DiscordProvider>{children}</DiscordProvider>
      </body>
    </html>
  )
}
