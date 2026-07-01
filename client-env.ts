// Loads variables from a local .env file into process.env (no-op if the file is absent,
// e.g. in Docker where env vars are provided by the runtime). Must run before any reads below.
import 'dotenv/config'

export type env = 'dev' | 'prod'

const str = (key: string, fallback = ''): string => process.env[key] ?? fallback
const bool = (key: string, fallback = false): boolean => (process.env[key] !== undefined ? process.env[key] === 'true' : fallback)

export const environment: env = str('ENVIRONMENT', 'dev') as env
export const database = str('DATABASE', 'dev')

export const discordSecret = str('DISCORD_SECRET')
export const discordAppId = str('DISCORD_APP_ID')

export const spotifyClientID = str('SPOTIFY_CLIENT_ID')
export const spotifyClientSecret = str('SPOTIFY_CLIENT_SECRET')

export const mwPw = str('MW_PW')
export const secretDevelopment = bool('SECRET_DEVELOPMENT', false)

export const lfKey = str('LF_KEY')
export const imgflip = { u: str('IMGFLIP_USER'), p: str('IMGFLIP_PASSWORD') }
export const actSSOCookie = str('ACT_SSO_COOKIE')

export const weatherAPIKey = str('WEATHER_API_KEY')
export const openWeatherAPIKey = str('OPEN_WEATHER_API_KEY')
export const openCageAPIKey = str('OPENCAGE_API_KEY')

export const vinmonopoletKey = str('VINMONOPOLET_KEY')
export const vinBearer = str('VIN_BEARER')
export const vinKey = str('VIN_KEY')
export const vinUserAgent = str('VIN_USER_AGENT')

export const trelloApiKey = str('TRELLO_API_KEY')
export const trelloToken = str('TRELLO_TOKEN')

export const rapidApiKey = str('RAPID_API_KEY')
export const rapidApiKey2 = str('RAPID_API_KEY_2')

export const musixMatchKey = str('MUSIXMATCH_KEY')

export const asposeClientID = str('ASPOSE_CLIENT_ID')
export const asposeClientSecret = str('ASPOSE_CLIENT_SECRET')

export const GeminiKey = str('GEMINI_KEY')

export const firebaseConfig = {
    apiKey: str('FIREBASE_API_KEY'),
    authDomain: str('FIREBASE_AUTH_DOMAIN'),
    databaseURL: str('FIREBASE_DATABASE_URL'),
    projectId: str('FIREBASE_PROJECT_ID'),
    storageBucket: str('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: str('FIREBASE_MESSAGING_SENDER_ID'),
    appId: str('FIREBASE_APP_ID'),
}

export const cloudflareConfig = {
    region: str('CLOUDFLARE_REGION', 'auto'),
    endpoint: str('CLOUDFLARE_ENDPOINT'),
    credentials: {
        accessKeyId: str('CLOUDFLARE_ACCESS_KEY_ID'),
        secretAccessKey: str('CLOUDFLARE_SECRET_ACCESS_KEY'),
    },
}
