import { Client } from 'discord.js'
import { initializeApp } from 'firebase/app'
import { JobScheduler } from '../Jobs/jobScheduler'
import { CommandBuilder } from '../builders/commandBuilder/commandBuilder'
import { environment, firebaseConfig } from '../client-env'

import { MazariniTracker } from '../general/mazariniTracker'
import { LockingHandler } from '../handlers/lockingHandler'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { FirebaseHelper } from '../helpers/firebaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { MazariniStorage } from '../interfaces/database/databaseInterface'
import { ClientListener } from './ClientListeners'

const Discord = require('discord.js')

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
    private cache: Partial<MazariniStorage>
    private clientListener: ClientListener

    constructor() {
        super({
            //Specifies intents needed to perform certain actions, i.e. what permissions the bot must have
            intents: [
                1, //  GatewayIntentBits.Guilds ,
                512, //  GatewayIntentBits.GuildMessages,
                64, // GatewayIntentBits.GuildInvites,
                4096, // GatewayIntentBits.DirectMessages,
                4, // GatewayIntentBits.GuildBans,
                8, // GatewayIntentBits.GuildEmojisAndStickers,
                2, //GatewayIntentBits.GuildMembers,
                32768, // GatewayIntentBits.MessageContent,
                1024, // GatewayIntentBits.GuildMessageReactions,
                2048, //  GatewayIntentBits.GuildMessageTyping,
                256, // GatewayIntentBits.GuildPresences,
                32, //  GatewayIntentBits.GuildWebhooks,
                16, //  GatewayIntentBits.GuildIntegrations,
                16384, //  GatewayIntentBits.DirectMessageTyping,
                128, //   GatewayIntentBits.GuildVoiceStates,
            ],
        })
        this.msgHelper = new MessageHelper(this)

        this.jobScheduler = new JobScheduler(this.msgHelper, this)
        this.lockingHandler = new LockingHandler()
        this.mazariniTracker = new MazariniTracker(this)
        this.clientListener = new ClientListener(this)
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
            //Uncomment to run command creation
            CommandBuilder.createCommands(this)
        }
    }

    get messageHelper() {
        return this.msgHelper
    }

    get database() {
        return this.databaseHelper
    }

    get lockHandler() {
        return this.lockingHandler
    }

    get tracker() {
        return this.mazariniTracker
    }

    /** TODO: Implement this better */
    get storageCache() {
        return this.cache
    }
    set storageCache(cache: Partial<MazariniStorage>) {
        this.cache = cache
    }
}
