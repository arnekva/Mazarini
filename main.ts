import moment from 'moment'
import { discordSecret } from './client-env'
import { MazariniClient } from './client/MazariniClient'

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

        this.setupClient(this.client)
    }

    setupClient(client: MazariniClient) {
        moment.updateLocale('nb', {})
        this.client.setupListeners()
        // this.client.createSlashCommands()
    }
}
