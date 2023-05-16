# Mazarini Bot

## Installering og Kjøring

Kjør 'npm install' i mappen for å installere dependencies.

Kjør 'npm run start' for å starte index.ts via nodemon. Denne gir hot reloads (restarter boten for hver kodeendring), men med database-filen på ignore.

## Viktig

Du må opprette en fil i main folder som heter 'client-env.ts' - bruk 'npm run create:env'
Denne filen må inneholde koden

```typescript
// "dev" for development, "prod" hvis du hoste boten live. "dev" vil sende warning hvis folk bruke boten mens du utvikler
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

Du må også opprette en 'myDataBase.json' fil. Bruk 'npm run create:db' for å opprette filen i rett struktur. Denne kan være tom, men eksempeldata du kan lime inn kan være:

```json
{
    "users": {
        "Arne": {
            "spin": "514",
            "ATHspin": "932",
            "mygling": "😊",
            "counterSpin": "321",
            "dogeCoin": "5000"
        },
        "ThomasW": {
            "mygling": "digge ny patch 🆒",
            "ATHspin": "742",
            "counterSpin": "213",
            "dogeCoin": "5000",
            "warningCounter": "2"
        },
        "Eivind": {
            "ATHspin": "915",
            "counterSpin": "1140",
            "dogeCoin": "5000"
        },
        "Deadmaggi": {
            "ATHspin": "303",
            "counterSpin": "5",
            "dogeCoin": "5000"
        },
        "Brzeczyszczykiewicz": {
            "ATHspin": "842",
            "counterSpin": "1945",
            "dogeCoin": "5000"
        }
    }
}
```
