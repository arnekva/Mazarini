// One-off runner (deleted after use): replaces today's daily-hub puzzles and Mastermind code in the prod database.
process.env.DATABASE = 'prod' // must be set before client-env is loaded
/* eslint-disable @typescript-eslint/no-var-requires */
const { initializeApp } = require('firebase/app')
const { getDatabase, get, child, ref } = require('firebase/database')
const { S3Client } = require('@aws-sdk/client-s3')
const { database, firebaseConfig, cloudflareConfig } = require('./client-env')
const { FirebaseHelper } = require('./helpers/firebaseHelper')
const { CloudflareHelper } = require('./helpers/cloudflareHelper')
const { DatabaseHelper } = require('./helpers/databaseHelper')
const { Scripts } = require('./scripts/scripts')

;(async () => {
    if (database !== 'prod') throw new Error('not pointed at prod: ' + database)
    const app = initializeApp(firebaseConfig)
    const root = ref(getDatabase(app))
    const snapshot = async () => {
        const c = (await get(child(root, 'prod/other/dailyHubChallenges'))).val()
        const mm = (await get(child(root, 'prod/other/mastermind'))).val()
        const answers = (g: string) => (c?.[g]?.items ?? []).map((i: any) => i.answer).join(', ')
        return { date: c?.date, flag: answers('flag'), capital: answers('capital'), outline: answers('outline'), mastermind: (mm ?? []).join(' ') }
    }
    console.log('BEFORE', await snapshot())
    const db = new DatabaseHelper(new FirebaseHelper(app, undefined), new CloudflareHelper(new S3Client(cloudflareConfig), undefined))
    const scripts = new Scripts({ database: db, messageHelper: { sendLogMessage: (m: string) => console.log('[log]', m) } } as any)
    await scripts.regenerateDailyTasks()
    await new Promise((r) => setTimeout(r, 4000)) // updateStorage / setMastermindSolution aren't awaited
    console.log('AFTER ', await snapshot())
    process.exit(0)
})().catch((e) => {
    console.error(e)
    process.exit(1)
})
