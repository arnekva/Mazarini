# Mazarini Bot

### Installering og Kjøring

Kjør 'npm install' i mappen for å installere dependencies.

Kjør 'npm run start' for å starte index.ts via nodemon. Inkluderer ignore for databasefil.


### Viktig
Du må opprette en fil i main folder som heter 'client-env.ts'
Denne filen på inneholde koden
```javascript
// "dev" for development, "prod" hvis du hoste boten live. "dev" vil sende warning hvis folk bruke boten mens du utvikle
export type env = "dev" | "prod";
export const environment: env = "dev";
```

Du må også opprette en 'myDataBase.json' fil. Denne kan være tom, men eksempeldata kan være:
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
            "ATHspin": "752",
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