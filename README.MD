# Mazarini Bot v15

## Installering og Kjøring

Kjør 'npm install' i mappen for å installere dependencies.

Kjør 'npm run start' for å starte index.ts via nodemon. Denne gir hot reloads (restarter boten for hver kodeendring), men med database-filen på ignore.

## Viktig

Du må opprette en fil i main folder som heter 'client-env.ts' - bruk 'npm run create:env'
Denne filen må inneholde koden

```typescript
export type env = 'dev' | 'prod'
export const environment: env = 'dev'
export const discordSecret = 'secret'
export const spotifyClientID = 'id'
export const spotifyClientSecret = 'secret'
export const mwPw = 'secret'
export const lfKey = 'secret'
export const imgflip = { u: 'un', p: 'secret' }
export const actSSOCookie = 'secret'
export const weatherAPIKey = 'secret'
```
