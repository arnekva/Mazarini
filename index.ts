import { commands, ICommandElement } from './commands/commands'
import { Admin } from './admin/admin'

import { Guild, GuildMember, Message, Role, TextChannel, User, Intents, CommandInteraction } from 'discord.js'
import { doesThisMessageNeedAnEivindPride } from './utils/miscUtils'
const Discord = require('discord.js')
export const mazariniClient = new Discord.Client({
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
const schedule = require('node-schedule')
const diff = require('deep-diff')
import didYouMean from 'didyoumean2'
import { DatabaseHelper } from './helpers/databaseHelper'
import { getRandomPercentage } from './utils/randomUtils'
import { MessageHelper } from './helpers/messageHelper'
import { UserCommands } from './commands/userCommands'
import { actSSOCookie, discordSecret, environment } from './client-env'
import { MessageUtils } from './utils/messageUtils'
import { ShopClass } from './commands/shop'
import { IDailyPriceClaim } from './commands/gamblingCommands'
import { DailyJobs } from './Jobs/dailyJobs'
import { WeeklyJobs } from './Jobs/weeklyJobs'
import { CommandRunner } from './General/commandRunner'
import { UserUtils } from './utils/userUtils'
const API = require('call-of-duty-api')()
require('dotenv').config()

export let action_log_channel: TextChannel
export const startTime = new Date()
export let numMessages = 0
export const isTest = environment === 'dev'

/** Login client */
if (discordSecret.includes('insert')) throw new TypeError('**FEIL** Klienten mangler Discord Secret Token i client-env.ts')
else mazariniClient.login(discordSecret)

mazariniClient.on('ready', async () => {
    try {
        await API.loginWithSSO(actSSOCookie)
    } catch (Error) {
        console.log('Failed to log in to activision with sso cookie')
    }
    const today = new Date()
    console.log(`Logged in as ${mazariniClient.user.tag} ${today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds()} !`)

    if (environment == 'prod')
        MessageHelper.sendMessageToActionLog(mazariniClient.channels.cache.get('810832760364859432'), 'Boten er nå live i production mode.')

    mazariniClient.user.setPresence({
        activity: {
            name: 'for !mz commands',
            type: 'WATCHING', //"PLAYING", "STREAMING", "WATCHING", "LISTENING"
        },
        status: 'online',
    })

    /** SCHEDULED JOBS */
    //https://www.npmjs.com/package/node-schedule
    /** Runs every day at 08:00 */
    const dailyJob = schedule.scheduleJob('0 8 * * *', async function () {
        DailyJobs.resetStatuses()
        DailyJobs.logEvent()
        DailyJobs.validateAndResetDailyClaims()
    })
    /** Runs once a week at mondays 08:00 */
    const weeklyJob = schedule.scheduleJob('0 8 * * 1', async function () {
        WeeklyJobs.awardWeeklyCoins()
        WeeklyJobs.logEvent()
    })

    const guild = mazariniClient.guilds.cache.find((g: Guild) => g.id === '340626855990132747') as Guild
    const bot = guild.members.cache.find((member) => member.id === '802945796457758760')
    bot?.setNickname(environment === 'dev' ? 'Bot Høie (TEST)' : 'Bot Høie')
})

/** For all sent messages */
mazariniClient.on('messageCreate', async (message: Message) => {
    numMessages++
    //Do not reply to own messages. Do not trigger on pinned messages
    if (message.author == mazariniClient.user || message.type == 'CHANNEL_PINNED_MESSAGE') return

    /** Check if message is calling lock commands */
    if (CommandRunner.checkForLockCommand(message)) return
    /** Check if message thread or channel is locked */
    if (CommandRunner.isThreadLocked(message)) return
    /** Check if user is locked */
    if (CommandRunner.isUserLocked(message)) return
    /** Check if bot is locked */
    if (CommandRunner.isBotLocked()) return
    /** Check if the bot is allowed to send messages in this channel */
    if (!CommandRunner.isLegalChannel(message)) return
    /**  Check message for commands */
    await CommandRunner.checkForCommand(message)
    /** Additional non-command checks */
    CommandRunner.checkMessageForJokes(message)
})

/** For interactions (slash-commands and user-commands) */
mazariniClient.on('interactionCreate', async (interaction: CommandInteraction) => {
    ShopClass.openShop(interaction, mazariniClient)
})

mazariniClient.on('channelCreate', function (channel: TextChannel) {
    MessageHelper.sendMessageToActionLog(channel, 'Ny channel opprettet: ' + channel.name)
})
mazariniClient.on('channelDelete', function (channel: TextChannel) {
    MessageHelper.sendMessageToActionLog(channel, 'Channel slettet: ' + channel.name)
})

mazariniClient.on('guildBanAdd', function (guild: Guild, user: User) {
    MessageHelper.sendMessageToActionLog(guild.channels.cache.first() as TextChannel, 'Bruker ble bannet: ' + user.tag)
})

mazariniClient.on('guildCreate', function (guild: Guild) {
    MessageHelper.sendMessageToActionLog(guild.channels.cache.first() as TextChannel, 'Ukjent: on guildCreate. Wat dis do?')
})

mazariniClient.on('guildMemberAdd', async function (member: GuildMember) {
    UserUtils.onAddedMember(member)
})
mazariniClient.on('guildMemberRemove', function (member: GuildMember) {
    UserUtils.onMemberLeave(member)
})

mazariniClient.on('userUpdate', function (oldUser: User, newUser: User) {
    UserUtils.onUserUpdate(oldUser, newUser)
})

//Emitted whenever a guild member changes - i.e. new role, removed role, nickname.
mazariniClient.on('guildMemberUpdate', function (oldMember: GuildMember, newMember: GuildMember) {
    UserUtils.onMemberUpdate(oldMember, newMember)
})

mazariniClient.on('roleCreate', function (role: Role) {
    MessageHelper.sendMessageToActionLog(role.guild.channels.cache.first() as TextChannel, 'En ny rolle er opprettet: ' + role.name)
})
mazariniClient.on('roleDelete', function (role: Role) {
    MessageHelper.sendMessageToActionLog(role.guild.channels.cache.first() as TextChannel, 'En rolle er slettet: ' + role.name)
})

mazariniClient.on('messageUpdate', function (oldMessage: Message, newMessage: Message) {
    CommandRunner.checkForCommand(newMessage)
    CommandRunner.checkMessageForJokes(newMessage)
})

mazariniClient.on('warn', function (info: string) {
    MessageHelper.sendMessageToActionLog(mazariniClient.channels.cache.get('810832760364859432') as TextChannel, 'En advarsel ble fanget opp. Info: \n ' + info)
})
mazariniClient.on('error', function (error: Error) {
    MessageHelper.sendMessageToActionLog(
        mazariniClient.channels.cache.get('810832760364859432') as TextChannel,
        'En feilmelding ble fanget opp. Error: \n ' + error
    )
})
