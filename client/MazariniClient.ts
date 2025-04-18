import { Client } from 'discord.js'
import { initializeApp } from 'firebase/app'
import { environment, firebaseConfig } from '../client-env'
import { JobScheduler } from '../Jobs/jobScheduler'

import { MazariniTracker } from '../general/mazariniTracker'
import { LockingHandler } from '../handlers/lockingHandler'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { FirebaseHelper } from '../helpers/firebaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { MoneyHelper } from '../helpers/moneyHelper'
import { ICache } from '../interfaces/database/databaseInterface'
import { ClientListener } from './ClientListeners'

/** Extension of Discord Client with extra properties like MessageHelper */
export class MazariniClient extends Client {
    /** Helper for sending and dealing with messages */
    private msgHelper: MessageHelper
    /** Schedules timed jobs. Handled in constructor for now */
    private jobScheduler: JobScheduler
    private databaseHelper: DatabaseHelper
    private lockingHandler: LockingHandler
    private mazariniTracker: MazariniTracker
    /** Cache of the Mazarini Storage from the database. Is pulled on startup, and updated during saving events. */
    private clientCache: Partial<ICache>
    private clientListener: ClientListener
    private moneyHelper: MoneyHelper

    constructor() {
        super({
            //Specifies intents needed to perform certain actions, i.e. what permissions the bot must have
            intents: [
                1, //  GatewayIntentBits.Guilds ,
                2, //GatewayIntentBits.GuildMembers,
                4, // GatewayIntentBits.GuildBans,
                8, // GatewayIntentBits.GuildEmojisAndStickers,
                16, //  GatewayIntentBits.GuildIntegrations,
                32, //  GatewayIntentBits.GuildWebhooks,
                64, // GatewayIntentBits.GuildInvites,
                128, //   GatewayIntentBits.GuildVoiceStates,
                256, // GatewayIntentBits.GuildPresences,
                512, //  GatewayIntentBits.GuildMessages,
                1024, // GatewayIntentBits.GuildMessageReactions,
                2048, //  GatewayIntentBits.GuildMessageTyping,
                4096, // GatewayIntentBits.DirectMessages,
                16384, //  GatewayIntentBits.DirectMessageTyping,
                32768, // GatewayIntentBits.MessageContent,
            ],
            rest: {
                timeout: 60000,
            },
        })
        this.msgHelper = new MessageHelper(this)
        this.jobScheduler = environment === 'prod' ? new JobScheduler(this.msgHelper, this) : undefined
        this.lockingHandler = new LockingHandler()
        this.mazariniTracker = new MazariniTracker(this)
        this.clientListener = new ClientListener(this)
        this.clientCache = { deathrollWinningNumbers: [], restartImpediments: [] }
        this.moneyHelper = new MoneyHelper(this)
        this.setupDatabase(this.msgHelper)

        this.clientListener.setupListeners()
    }

    /** Starts property listeners for client.  */

    setupDatabase(msgHelper: MessageHelper) {
        const firebaseApp = initializeApp(firebaseConfig)
        const fbHelper = new FirebaseHelper(firebaseApp, msgHelper)
        this.databaseHelper = new DatabaseHelper(fbHelper)
    }

    /** Run this to create slash commands from CommandBuilder. Will only run in dev mode */
    createSlashCommands() {
        if (environment === 'dev') {
            //hehe ty one time hack
            //Uncomment to run command creation
            // CommandBuilder.createCommands(this)
            // CommandBuilder.deleteCommandByName('grid', this)
        }
    }

    /** This will run before a restart happens */
    async onRestart(): Promise<boolean> {
        this.messageHelper.sendLogMessage('Running Save for all command classes')
        await this.clientListener.commandRunner.runSave()
        return true
    }

    async onRefresh(): Promise<boolean> {
        this.messageHelper.sendLogMessage('Running Refresh for all command classes')
        await this.clientListener.commandRunner.runRefresh()
        return true
    }

    async onTimedEvent(timing: 'daily' | 'weekly' | 'hourly'): Promise<boolean> {
        this.messageHelper.sendLogMessage(`Running ${timing} jobs for all command classes`)
        await this.clientListener.commandRunner.runJobs(timing)
        return true
    }

    get messageHelper() {
        return this.msgHelper
    }

    get database() {
        return this.databaseHelper
    }

    get bank() {
        return this.moneyHelper
    }

    get lockHandler() {
        return this.lockingHandler
    }

    get tracker() {
        return this.mazariniTracker
    }

    get cache() {
        return this.clientCache
    }
    set cache(cache: Partial<ICache>) {
        this.clientCache = cache
    }
}
