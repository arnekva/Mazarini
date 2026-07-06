import moment from 'moment'
import { discordSecret } from './client-env'
import { MazariniClient } from './client/MazariniClient'
import { CCGCardGenerator } from './helpers/ccgCardGenerator'
import { RestartServer } from './helpers/restartServer'

export class MazariniBot {
    private client: MazariniClient
    private isShuttingDown = false

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
        this.registerProcessHandlers()
    }

    /**
     * Keep a single stray error from taking down the whole bot (and wiping the unsaved in-memory cache),
     * and make sure the cache is persisted whenever the process is shutting down.
     */
    private registerProcessHandlers() {
        // Benign async errors — most commonly Discord's "Unknown Interaction" (code 10062) when discord.js
        // can't find an interaction — must NOT crash the process. Log and keep running.
        process.on('unhandledRejection', (reason) => {
            console.error('[unhandledRejection] kept bot alive:', reason)
        })
        // An uncaught exception can leave the process in a bad state, so save the cache and let the
        // container's restart policy bring it back cleanly — with user data intact.
        process.on('uncaughtException', (err) => {
            console.error('[uncaughtException]', err)
            void this.saveAndExit(1)
        })
        // Graceful shutdown (Watchtower deploy / docker stop sends SIGTERM) — persist before exiting.
        process.on('SIGTERM', () => void this.saveAndExit(0))
        process.on('SIGINT', () => void this.saveAndExit(0))
    }

    /** Persist all command-class state (the cache) to the database, then exit so nothing is lost on restart. */
    private async saveAndExit(code: number) {
        if (this.isShuttingDown) return
        this.isShuttingDown = true
        try {
            await this.client?.onRestart(true)
        } catch (e) {
            console.error('[saveAndExit] failed to save cache before exit:', e)
        }
        process.exit(code)
    }

    async initBot() {
        /** Login client */
        console.log('Initializing client, logging in')

        await this.client.login(discordSecret)
        console.log('Logged in, starting setup')
        this.client.createSlashCommands()

        // Localhost endpoint that gates automated deploys on the same guards as the /restart command
        new RestartServer(this.client).start()

        // Generate CCG card images asynchronously on startup using local card definitions
        CCGCardGenerator.generateAll(this.client).catch((err) => {
            console.error('[CCG] Card generation failed:', err)
        })

        // this.client.user.edit({ avatar: 'hoie2.gif' })
        moment.updateLocale('nb', {})
    }
}
