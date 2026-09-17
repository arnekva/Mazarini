import { DiscordProvider } from "@/providers/discordProvider"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Daily",
  description: "Mazarini daily hub",
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
