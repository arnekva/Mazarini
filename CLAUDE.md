# Mazarini — Discord Bot

A feature-rich Discord bot for a private Norwegian friend group. Written in TypeScript, runs on a Raspberry Pi in production.

## Tech Stack

- **Discord.js** — bot framework
- **Firebase Realtime Database** — primary data store (`FirebaseHelper` → `DatabaseHelper`)
- **Cloudflare R2** — blob/image storage (`CloudflareHelper`)
- **curl-impersonate** (`curl_chrome116`) — browser-impersonating HTTP client shelled out to for scraping (e.g. tracker.gg for Rocket League stats)
- **Gemini AI** — used via `GeminiHelper`
- **Node.js / TypeScript** — `npm run build` compiles, `npm start` runs

## Architecture

### Client
`MazariniClient` (`client/MazariniClient.ts`) extends Discord's `Client`. It owns all helpers and is passed into every command class.

### Commands
All command handlers live in `commands/` and extend `AbstractCommands` (`Abstracts/AbstractCommand.ts`). Each class implements `getAllInteractions()` returning slash commands and button handlers.

Use the custom interaction types from `Abstracts/MazariniInteraction.ts` — **not** raw Discord.js types:
- `ChatInteraction` instead of `ChatInputCommandInteraction<CacheType>`
- `BtnInteraction` instead of `ButtonInteraction<CacheType>`

### Database
Always go through `DatabaseHelper` (`helpers/databaseHelper.ts`), never call `FirebaseHelper` directly from commands.

Key pattern:
```ts
const user = await this.client.database.getUser(interaction.user.id)
user.someField = newValue
await this.client.database.updateUser(user)
```

`updateUser` and `updateData` are async — always `await` them or writes may silently fail.

### Message sending
Use `this.messageHelper` (injected via `AbstractCommands`) for replies and channel messages, not raw Discord interaction methods where avoidable.

### Jobs
Timed work lives in `Jobs/` — `dailyJobs.ts`, `hourlyJobs.ts`, `weeklyJobs.ts`. Scheduled via `JobScheduler`.

## Features

| Area | Directory |
|------|-----------|
| CCG card game | `commands/ccg/` |
| Money / economy | `commands/money/` |
| Gambling games (blackjack, deathroll, ludo, mastermind…) | `commands/games/` |
| Loot boxes / store | `commands/store/` |
| Rocket League stats (tracker.gg via curl-impersonate) | `commands/gaming/` |
| Drinks / Vinmonopolet | `commands/drinks/` |
| Calendar | `commands/calendarCommands.ts` |
| Crime | `commands/money/crimeCommands.ts` |
| Memes, text commands, polls | root `commands/` |

## Environments

- **prod** — Raspberry Pi.
- **dev** — local Windows/Mac.

Check `environment` from `client-env.ts` to branch between them (see e.g. `rocketleagueCommands.ts`).

Scraping (e.g. Rocket League stats) shells out to the `curl_chrome116` binary (curl-impersonate), which must be installed on the host / in the container.

## Language

User-facing strings (error messages, replies) are in **Norwegian**.

## Common Gotchas

