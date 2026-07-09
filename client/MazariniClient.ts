import { ApplicationEmoji, Client, Collection } from 'discord.js'
import { initializeApp } from 'firebase/app'
import { cloudflareConfig, environment, firebaseConfig, secretDevelopment } from '../client-env'
import { JobScheduler } from '../Jobs/jobScheduler'

import { S3Client } from '@aws-sdk/client-s3'
import { EventTracker } from '../general/eventTracker'
import { MazariniTracker } from '../general/mazariniTracker'
import { LockingHandler } from '../handlers/lockingHandler'
import { CloudflareHelper } from '../helpers/cloudflareHelper'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { FirebaseHelper } from '../helpers/firebaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { MoneyHelper } from '../helpers/moneyHelper'
import { ICache } from '../interfaces/database/databaseInterface'
import { ChannelIds } from '../utils/mentionUtils'
import { ClientListener } from './ClientListeners'
import { MazariniEvents } from './events/MazariniEvents'

/** Extension of Discord Client with extra properties like MessageHelper */
export class MazariniClient extends Client {
    /** Helper for sending and dealing with messages */
    private msgHelper: MessageHelper
    /** Schedules timed jobs. Handled in constructor for now */
    private jobScheduler: JobScheduler
    private databaseHelper: DatabaseHelper
    private lockingHandler: LockingHandler
    private mazariniTracker: MazariniTracker
    private timedEvents: MazariniEvents
    private mazariniEventTracker: EventTracker
    /** Cache of the Mazarini Storage from the database. Is pulled on startup, and updated during saving events. */
    private clientCache: Partial<ICache>
    private clientListener: ClientListener
    private moneyHelper: MoneyHelper
    private developmentChannelId: string

    constructor() {
        super({
            //Specifies intents needed to perform certain actions, i.e. what permissions the bot must have
            intents: [
                1, //  GatewayIntentBits.Guilds,
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
        this.timedEvents = new MazariniEvents(this)
        this.mazariniEventTracker = new EventTracker(this)
        this.clientListener = new ClientListener(this)
        this.clientCache = { deathrollWinningNumbers: [], restartImpediments: [] }
        this.developmentChannelId = secretDevelopment ? ChannelIds.SECRET_LOCALHOST : ChannelIds.LOCALHOST
        this.moneyHelper = new MoneyHelper(this)
        this.setupDatabase(this.msgHelper)
        this.clientListener.setupListeners()
    }

    /** Starts property listeners for client.  */

    setupDatabase(msgHelper: MessageHelper) {
        const firebaseApp = initializeApp(firebaseConfig)
        const fbHelper = new FirebaseHelper(firebaseApp, msgHelper)
        const s3Client = new S3Client(cloudflareConfig)
        const cfHelper = new CloudflareHelper(s3Client, msgHelper)
        this.databaseHelper = new DatabaseHelper(fbHelper, cfHelper)
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
    async onRestart(silent = false): Promise<boolean> {
        if (!silent) this.messageHelper.sendLogMessage('Running Save for all command classes')
        await this.clientListener.commandRunner.runSave()
        return true
    }

    /**
     * Runs save for all command classes and returns any reasons a restart should be blocked right now
     * (e.g. active games). Empty array means it is safe to restart. Shared by the /restart command and
     * the /restart-check endpoint so manual and automated deploys honour the exact same guards.
     * @param silent suppress the "Running Save" log message (used by the high-frequency deploy poll)
     */
    async collectRestartImpediments(silent = false): Promise<string[]> {
        this.clientCache.restartImpediments = []
        await this.onRestart(silent)
        return this.clientCache.restartImpediments ?? []
    }

    async onRefresh(): Promise<boolean> {
        this.messageHelper.sendLogMessage('Running Refresh for all command classes')
        await this.clientListener.commandRunner.runRefresh()
        return true
    }

    async onTimedEvent(timing: 'daily' | 'weekly' | 'hourly'): Promise<boolean> {
        await this.clientListener.commandRunner.runJobs(timing)
        return true
    }

    onBotReady() {
        this.clientListener.commandRunner.runOnReady()
        this.messageHelper.sendLogMessage('Running onLogin for all command classes')
    }

    async getEmojis(): Promise<Collection<string, ApplicationEmoji>> {
        if (this.clientCache.applicationEmojis) return this.clientCache.applicationEmojis
        const applicationEmojis = await this.application.emojis.fetch()
        this.clientCache.applicationEmojis = applicationEmojis
        return applicationEmojis
    }

    getEmojiFromCollection(name: string, emojis: Collection<string, ApplicationEmoji>) {
        const emoji = emojis.find((candidate) => candidate.name === name)
        if (!emoji) return { id: '<Fant ikke emojien>' }
        return {
            id: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`,
            emojiObject: emoji,
            urlId: emoji.id,
        }
    }

    async getEmoji(name: string) {
        return this.getEmojiFromCollection(name, await this.getEmojis())
    }

    invalidateEmojiCache() {
        delete this.clientCache.applicationEmojis
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

    get mazariniEvents() {
        return this.timedEvents
    }

    get eventTracker() {
        return this.mazariniEventTracker
    }

    get cache() {
        return this.clientCache
    }

    get currentDevelopmentChannelId() {
        return this.developmentChannelId
    }

    set currentDevelopmentChannelId(channelId: string) {
        if (channelId) this.developmentChannelId = channelId
    }

    set cache(cache: Partial<ICache>) {
        this.clientCache = cache
    }
}
