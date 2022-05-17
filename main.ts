import {
    CacheType,
    Client,
    DMChannel,
    Guild,
    GuildBan,
    GuildMember,
    Intents,
    Interaction,
    Message,
    NonThreadGuildBasedChannel,
    PartialGuildMember,
    PartialMessage,
    PartialUser,
    Role,
    TextChannel,
    User,
} from 'discord.js'
import { discordSecret, environment } from './client-env'
import { CommandRunner } from './General/commandRunner'
import { ClientHelper } from './helpers/clientHelper'
import { MessageHelper } from './helpers/messageHelper'
import { DailyJobs } from './Jobs/dailyJobs'
import { DayJob } from './Jobs/dayJobs'
import { WeeklyJobs } from './Jobs/weeklyJobs'
import { MessageUtils } from './utils/messageUtils'
import { UserUtils } from './utils/userUtils'

const Discord = require('discord.js')

const schedule = require('node-schedule')
const axon = require('pm2-axon')
const sub = axon.socket('sub-emitter')
const pm2 = require('pm2')

export class MazariniClient {
    private client: Client
    private commandRunner: CommandRunner
    private messageHelper: MessageHelper
    static numMessages: number
    private isTest: boolean
    private startTime: Date
    mazarini: any

    constructor() {
        this.client = new Discord.Client({
            intents: [
                Intents.FLAGS.GUILDS,
                Intents.FLAGS.GUILD_MESSAGES,
                Intents.FLAGS.GUILD_INVITES,
                Intents.FLAGS.DIRECT_MESSAGES,
                Intents.FLAGS.GUILD_BANS,
                Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
                Intents.FLAGS.GUILD_MEMBERS,
                Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
                Intents.FLAGS.GUILD_MESSAGE_TYPING,
                Intents.FLAGS.GUILD_PRESENCES,
                Intents.FLAGS.GUILD_WEBHOOKS,
                Intents.FLAGS.GUILD_INTEGRATIONS,
                Intents.FLAGS.DIRECT_MESSAGE_TYPING,
                Intents.FLAGS.GUILD_VOICE_STATES,
            ],
        })
        this.messageHelper = new MessageHelper(this.client)
        this.commandRunner = new CommandRunner(this.client, this.messageHelper)
        this.startTime = new Date()
        MazariniClient.numMessages = 0
        this.isTest = environment === 'dev'
    }

    async initClient() {
        /** Login client */
        await this.client.login(discordSecret)
        this.setupClient(this.client)
    }

    setupClient(client: Client) {
        const _mzClient = this
        const _msgHelper = this.messageHelper
        client.on('ready', async () => {
            const today = new Date()
            console.log(`Logged in as ${_mzClient.client.user?.tag} ${today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds()} !`)

            if (environment == 'prod')
                _msgHelper.sendMessageToActionLog(
                    _mzClient.client.channels.cache.get('810832760364859432') as TextChannel,
                    'Boten er nå live i production mode.'
                )

            ClientHelper.setStatusFromStorage(client)

            /** SCHEDULED JOBS */
            //https://www.npmjs.com/package/node-schedule
            /** Runs every day at 06:00 */
            const dailyJob = schedule.scheduleJob('0 6 * * *', async function () {
                const jobs = new DailyJobs(_msgHelper)
                jobs.runJobs()
            })
            /** Runs once a week at mondays 06:00 */
            const weeklyJob = schedule.scheduleJob('0 6 * * 1', async function () {
                const jobs = new WeeklyJobs(_msgHelper)
                jobs.runJobs()
            })
            const fridayJob = schedule.scheduleJob('0 16 * * 5', async function () {
                const jobs = new DayJob(_msgHelper, 'friday')
                jobs.runJobs()
            })

            const guild = client.guilds.cache.find((g: Guild) => g.id === '340626855990132747') as Guild
            const bot = guild.members.cache.find((member) => member.id === '802945796457758760')
            bot?.setNickname(environment === 'dev' ? 'Bot Høie (TEST)' : 'Bot Høie')

            pm2.launchBus(function (err: any, bus: any) {
                // Listen for process errors

                bus.on('log:err', function (data: any) {
                    _msgHelper.sendMessageToActionLog(
                        _mzClient.client.channels.cache.get('810832760364859432') as TextChannel,
                        'En feilmelding har blitt logget til konsollen (log:err) \n**Melding:** ' +
                            `\n**Message**: ${data?.data ?? 'NONE'}\n**Unix timestamp**: ${data?.at ?? 'NONE'}`
                    )
                })

                // Listen for PM2 kill

                bus.on('pm2:kill', function (data: any) {
                    _msgHelper.sendMessageToActionLog(
                        _mzClient.client.channels.cache.get('810832760364859432') as TextChannel,
                        'pm2 logget en melding til konsollen. pm2:kill. Melding: ' + data
                    )
                })

                // Listen for process exceptions

                bus.on('process:exception', function (data: any) {
                    if (!data?.data?.stack?.includes('ENOTFOUND') || !data?.data?.stack?.includes('discord.com')) {
                        _msgHelper.sendMessageToActionLog(
                            _mzClient.client.channels.cache.get('810832760364859432') as TextChannel,
                            'PM2 logget en feil. Process:exception. Dette er en DISCORD.COM feilmelding: ENOTFOUND.'
                        )
                    }
                    if (!data?.data?.stack?.includes('fewer in length')) {
                        _msgHelper.sendMessageToActionLog(
                            _mzClient.client.channels.cache.get('810832760364859432') as TextChannel,

                            'pm2 logget en melding til konsollen. Process:exception. Melding: ' +
                                `\n* **Message**: ${data?.data?.message ?? 'NONE'}\n* **Error** name: ${data?.data?.name ?? 'NONE'}\n* **Callsite**: ${
                                    data?.data?.callsite ?? 'NONE'
                                }\n* **Context**: ${data?.data?.context ?? 'NONE'}\n* **Stacktrace**: ${data?.data?.stack ?? 'NONE'}`
                        )
                    }
                })
            })
        })

        /** For all sent messages */
        client.on('messageCreate', async (message: Message) => {
            MazariniClient.numMessages++
            //Do not reply to own messages. Do not trigger on pinned messages
            if (message.author == client.user || message.type == 'CHANNEL_PINNED_MESSAGE') return

            _mzClient.commandRunner.runCommands(message)
        })

        client.on('messageDelete', async (message: Message<boolean> | PartialMessage) => {
            if (!message.guild) return
            const fetchedLogs = await message?.guild.fetchAuditLogs({
                limit: 1,
                type: 'MESSAGE_DELETE',
            })
            const actionLogId = '810832760364859432'

            const deletionLog = fetchedLogs.entries.first()

            if (!deletionLog) {
                // _msgHelper.sendMessage(actionLogId, `En melding av ${message.author.tag} ble slettet, men ingen audit logs ble funnet knyttet til meldingen.`)
                return
            }
            const { executor, target } = deletionLog

            if (
                target?.id === message?.author?.id &&
                message.channelId !== MessageUtils.CHANNEL_IDs.ACTION_LOG &&
                !message?.content?.includes('Laster data') &&
                !message?.content?.includes('Henter data')
            ) {
                _msgHelper.sendMessage(
                    actionLogId,
                    `**En melding av** *${message?.author?.tag}* **ble slettet av** *${executor?.tag}*. **Innhold**: '*${message?.content}*'`
                )
            }
        })

        /** For interactions (slash-commands and user-commands) */
        client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
            if (interaction.channelId)
                _msgHelper.sendMessage(interaction.channelId, 'Shoppen er dessverre stengt. Her må du masa på Maggi for at han ska fiksa an')

            // ShopClass.openShop(interaction, client)
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
            _msgHelper.sendMessageToActionLog(guild.channels.cache.first() as TextChannel, 'Ukjent: on guildCreate. Wat dis do?')
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
            _msgHelper.sendMessageToActionLog(role.guild.channels.cache.first() as TextChannel, 'En ny rolle er opprettet: ' + role.name)
        })
        client.on('roleDelete', function (role: Role) {
            _msgHelper.sendMessageToActionLog(role.guild.channels.cache.first() as TextChannel, 'En rolle er slettet: ' + role.name)
        })

        client.on('messageUpdate', function (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
            if (!newMessage.pinned && !oldMessage.pinned) {
                _mzClient.commandRunner.checkForCommand(newMessage as Message)
                _mzClient.commandRunner.checkMessageForJokes(newMessage as Message)
            }
        })

        // client.on('warn', function (info: string) {
        //     _msgHelper.sendMessageToActionLog(client.channels.cache.get('810832760364859432') as TextChannel, 'En advarsel ble fanget opp. Info: \n ' + info)
        // })

        client.on('error', function (error: Error) {
            _msgHelper.sendMessageToActionLog(
                client.channels.cache.get('810832760364859432') as TextChannel,
                'En feilmelding ble fanget opp. Error: \n ' + error
            )
        })
    }

    testContext() {
        return {
            client: this.client,
        }
    }
}
