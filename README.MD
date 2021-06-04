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