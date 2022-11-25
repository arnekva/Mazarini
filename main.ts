import {
    AuditLogEvent,
    CacheType,
    Client,
    DMChannel,
    GatewayIntentBits,
    Guild,
    GuildBan,
    GuildMember,
    Interaction,
    Message,
    MessageType,
    NonThreadGuildBasedChannel,
    PartialGuildMember,
    PartialMessage,
    PartialUser,
    Role,
    User,
} from 'discord.js'
import moment from 'moment'
import { discordSecret, environment } from './client-env'
import { CommandRunner } from './general/commandRunner'
import { ErrorHandler } from './handlers/errorHandler'
import { ClientHelper } from './helpers/clientHelper'
import { MessageHelper } from './helpers/messageHelper'
import { JobScheduler } from './Jobs/jobScheduler'
import { ArrayUtils } from './utils/arrayUtils'
import { MentionUtils } from './utils/mentionUtils'
import { MessageUtils } from './utils/messageUtils'
import { textArrays } from './utils/textArrays'
import { UserUtils } from './utils/userUtils'

const Discord = require('discord.js')
const axon = require('pm2-axon')
const sub = axon.socket('sub-emitter')
const pm2 = require('pm2')

export class MazariniClient {
    private client: Client
    private commandRunner: CommandRunner
    private messageHelper: MessageHelper
    private jobScheduler: JobScheduler
    private errorHandler: ErrorHandler
    static numMessages: number
    static numMessagesFromBot: number
    static numMessagesNumErrorMessages: number
    private isTest: boolean
    static startTime: Date
    mazarini: any

    constructor() {
        this.client = new Discord.Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildBans,
                GatewayIntentBits.GuildEmojisAndStickers,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildMessageTyping,
                GatewayIntentBits.GuildPresences,
                GatewayIntentBits.GuildWebhooks,
                GatewayIntentBits.GuildIntegrations,
                GatewayIntentBits.DirectMessageTyping,
                GatewayIntentBits.GuildVoiceStates,
            ],
        })
        this.messageHelper = new MessageHelper(this.client)
        this.commandRunner = new CommandRunner(this.client, this.messageHelper)
        MazariniClient.startTime = new Date()
        MazariniClient.numMessages = 0
        this.isTest = environment === 'dev'
    }

    async initClient() {
        /** Login client */
        console.log('Initializing client')
        console.log('Logging in')

        await this.client.login(discordSecret)
        console.log('Logged in, starting setup')

        this.setupClient(this.client)
    }

    setupClient(client: Client) {
        const _mzClient = this
        const _msgHelper = this.messageHelper
        moment.updateLocale('nb', {})
        client.on('ready', async () => {
            console.log(
                `Setup ready, bot is ready as ${_mzClient.client.user?.tag} at ${new Date().toLocaleDateString('nb', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })} ${new Date().toLocaleTimeString('nb')} !`
            )

            if (environment == 'prod') _msgHelper.sendMessageToActionLog('Boten er nå live i production mode.')

            ClientHelper.setStatusFromStorage(client)

            /** SCHEDULED JOBS - resets every day at 06:00 */
            this.jobScheduler = new JobScheduler(_msgHelper)

            const guild = client.guilds.cache.find((g: Guild) => g.id === '340626855990132747') as Guild
            const bot = guild.members.cache.find((member) => member.id === '802945796457758760')
            bot?.setNickname(environment === 'dev' ? 'Bot Høie (TEST)' : 'Bot Høie')

            this.errorHandler = new ErrorHandler(_msgHelper)
            this.errorHandler.launchBusListeners()
        })

        /** For all sent messages */
        client.on('messageCreate', async (message: Message) => {
            MazariniClient.numMessages++
            //Do not reply to own messages. Do not trigger on pinned messages
            if (message?.author?.username == client?.user?.username || message?.type === MessageType.ChannelPinnedMessage) {
                MazariniClient.numMessagesFromBot++
            } else {
                _mzClient.commandRunner.runCommands(message)

                if (message.mentions.users.find((u) => u.id === MentionUtils.User_IDs.BOT_HOIE)) {
                    message.reply(ArrayUtils.randomChoiceFromArray(textArrays.bentHoieLines))
                }
            }
        })

        client.on('messageDelete', async (message: Message<boolean> | PartialMessage) => {
            if (!message.guild) return
            const fetchedLogs = await message?.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MessageDelete,
            })
            const actionLogId = '810832760364859432'

            const deletionLog = fetchedLogs.entries.first()

            if (!deletionLog) {
                return
            }
            const { executor, target } = deletionLog
            const createdAt = { hours: new Date(deletionLog.createdAt).getHours(), min: new Date(deletionLog.createdAt).getMinutes() }
            const now = { hours: new Date().getHours(), min: new Date().getMinutes() }
            const timeMatches = (): boolean => {
                return createdAt.hours === now.hours && createdAt.min === now.min
            }
            if (
                target?.id === message?.author?.id &&
                message.channelId !== MessageUtils.CHANNEL_IDs.ACTION_LOG &&
                !message?.content?.includes('Laster data') &&
                !message?.content?.includes('Henter data') &&
                timeMatches()
            ) {
                _msgHelper.sendMessage(
                    actionLogId,
                    `**En melding av** *${message?.author?.tag}* **ble slettet av** *${executor?.tag}*. **Innhold**: '*${message?.content}*'`
                )
            }
        })

        /** For interactions (slash-commands and user-commands) */
        client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
            _mzClient.commandRunner.checkForCommandInInteraction(interaction)
        })

        client.on('channelDelete', (channel: DMChannel | NonThreadGuildBasedChannel) => {
            const id = '810832760364859432'
            _msgHelper.sendMessage(id, `Channel med ID ${channel.id} ble slettet`)
        })

        client.on('guildBanAdd', (ban: GuildBan) => {
            const id = '810832760364859432'
            _msgHelper.sendMessage(id, `${ban.user.username} ble bannet pga ${ban?.reason}`)
        })

        client.on('guildCreate', (guild: Guild) => {
            _msgHelper.sendMessageToActionLog('Ukjent: on guildCreate. Wat dis do?')
        })

        client.on('guildMemberAdd', async (member: GuildMember) => {
            UserUtils.onAddedMember(member, _msgHelper)
        })
        client.on('guildMemberRemove', (member: GuildMember | PartialGuildMember) => {
            UserUtils.onMemberLeave(member, _msgHelper)
        })

        client.on('userUpdate', function (oldUser: User | PartialUser, newUser: User) {
            UserUtils.onUserUpdate(oldUser, newUser, _msgHelper)
        })

        //Emitted whenever a guild member changes - i.e. new role, removed role, nickname.
        client.on('guildMemberUpdate', function (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
            UserUtils.onMemberUpdate(oldMember, newMember, _msgHelper)
        })

        client.on('roleCreate', function (role: Role) {
            _msgHelper.sendMessageToActionLog('En ny rolle er opprettet: ' + role.name)
        })
        client.on('roleDelete', function (role: Role) {
            _msgHelper.sendMessageToActionLog('En rolle er slettet: ' + role.name)
        })

        client.on('messageUpdate', function (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
            if (!newMessage.pinned && !oldMessage.pinned && !!newMessage.author) {
                _mzClient.commandRunner.checkMessageForJokes(newMessage as Message)
                if (newMessage.content.startsWith('/') && !newMessage.content.startsWith('//')) {
                    //Dont trigger on TODO's
                    newMessage.reply(
                        'Du kan ikkje gjør ein slash-command når du redigere ein melding. Du må senda ein ny melding for å trigga commanden. Skyld på Discord for dårlig UX her, ikkje meg'
                    )
                }
            }
        })

        client.on('error', function (error: Error) {
            _msgHelper.sendMessageToActionLog('En feilmelding ble fanget opp. Error: \n ' + error)
        })
    }

    testContext() {
        return {
            client: this.client,
        }
    }
}
