import { DiscordProvider } from "@/providers/discordProvider"
import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Daily",
  description: "Mazarini daily hub",
}

export const viewport: Viewport = {
  viewportFit: "cover",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <DiscordProvider>{children}</DiscordProvider>
      </body>
    </html>
  )
}
