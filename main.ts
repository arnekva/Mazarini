import moment from 'moment'
import { discordSecret } from './client-env'
import { MazariniClient } from './client/MazariniClient'
const { Util } = require('discord.js')

const Discord = require('discord.js')
const axon = require('pm2-axon')
const sub = axon.socket('sub-emitter')
const pm2 = require('pm2')

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
    }

    testContext() {
        return {
            client: this.client,
        }
    }
}
