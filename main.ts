import moment from 'moment'
import { discordSecret } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { CCGCardGenerator } from './helpers/ccgCardGenerator'

export class MazariniBot {
    private client: MazariniClient

    static numMessages: number = 0
    static numMessagesFromBot: number = 0
    static numMessagesNumErrorMessages: number = 0
    static numCommands: number = 0
    static startTime: Date
    mazarini: any

    constructor() {
        this.client = new MazariniClient()
        MazariniBot.startTime = new Date()
        MazariniBot.numMessages = 0
    }

    async initBot() {
        /** Login client */
        console.log('Initializing client, logging in')

        await this.client.login(discordSecret)
        console.log('Logged in, starting setup')
        this.client.createSlashCommands()

        // Generate CCG card images asynchronously on startup, using cards from DB if available
        this.client.database
            .getStorage()
            .then((storage) => {
                const dbCcg = storage?.ccg
                const dbCards = dbCcg ? [...(dbCcg.mazariniCCG ?? []), ...(dbCcg.swCCG ?? [])] : undefined
                CCGCardGenerator.generateAll(this.client, dbCards?.length ? dbCards : undefined).catch((err) => {
                    console.error('[CCG] Card generation failed:', err)
                })
            })
            .catch((err) => {
                console.error('[CCG] Failed to fetch storage for card generation, falling back to local cards:', err)
                CCGCardGenerator.generateAll(this.client).catch((err2) => {
                    console.error('[CCG] Card generation (fallback) failed:', err2)
                })
            })

        // this.client.user.edit({ avatar: 'hoie2.gif' })
        moment.updateLocale('nb', {})
    }
}
