// Server-only env access. Never import this from a "use client" component - Next.js only inlines
// NEXT_PUBLIC_* vars into the browser bundle, and everything below is a secret that must stay server-side.

const str = (key: string, fallback = ""): string => process.env[key] ?? fallback

export const discordClientId = str("NEXT_PUBLIC_DISCORD_CLIENT_ID")
export const discordClientSecret = str("DISCORD_CLIENT_SECRET")
export const discordBotToken = str("DISCORD_BOT_TOKEN")

export const database = str("DATABASE", "dev")

export const firebaseConfig = {
  apiKey: str("FIREBASE_API_KEY"),
  authDomain: str("FIREBASE_AUTH_DOMAIN"),
  databaseURL: str("FIREBASE_DATABASE_URL"),
  projectId: str("FIREBASE_PROJECT_ID"),
  storageBucket: str("FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: str("FIREBASE_MESSAGING_SENDER_ID"),
  appId: str("FIREBASE_APP_ID"),
}
