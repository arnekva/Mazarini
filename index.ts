import { commands, ICommandElement } from './commands/commands'
import { Admin } from './admin/admin'

import {
    Guild,
    GuildMember,
    Message,
    Role,
    TextChannel,
    User,
    Emoji,
    Intents,
    Interaction,
    MessageSelectMenu,
    CommandInteraction,
    MessageEmbed,
    MessageActionRow,
    MessageButton,
} from 'discord.js'
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
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_INTEGRATIONS,
        Intents.FLAGS.DIRECT_MESSAGE_TYPING,
        Intents.FLAGS.GUILD_VOICE_STATES,
    ],
})
const schedule = require('node-schedule')
const diff = require('deep-diff')
import didYouMean from 'didyoumean2'
import { DatabaseHelper } from './helpers/databaseHelper'

import { MessageHelper } from './helpers/messageHelper'
import { Spinner } from './commands/spinner'
import { UserCommands } from './commands/userCommands'
import { actSSOCookie, discordSecret, environment } from './client-env'
import { MessageUtils } from './utils/messageUtils'
import { ArrayUtils } from './utils/arrayUtils'
import { globalArrays } from './globals'
const API = require('call-of-duty-api')()
require('dotenv').config()

/******* VARIABLES */
const polseRegex = new RegExp(/(p)(ø|ö|y|e|o|a|u|i|ô|ò|ó|â|ê|å|æ|ê|è|é|à|á)*(ls)(e|a|å|o|i)|(pause)|(🌭)|(hotdog)|(sausage)|(hot-dog)/gi)
let lastUsedCommand = 'help'
export let action_log_channel: TextChannel
export const startTime = new Date()
export let botLocked: boolean = false
export let lockedUser: string[] = []
export let lockedThread: string[] = []
export let numMessages = 0
/******* END */
mazariniClient.on('ready', async () => {
    try {
        await API.loginWithSSO(actSSOCookie)
    } catch (Error) {
        console.log('failed to log in')
    }
    const args = process.argv.slice(2)

    action_log_channel = mazariniClient.channels.cache.get('810832760364859432')

    //TODO: Move this into own function
    const las_vegas = mazariniClient.channels.cache.get('808992127249678386') as TextChannel
    las_vegas.permissionOverwrites.edit('340626855990132747', {
        SEND_MESSAGES: true,
    })
    const lvmsg = (await las_vegas.messages.fetch({ limit: 1 })).first()
    if (lvmsg?.content) {
        if (lvmsg.content.includes('utviklingsmodus') && environment === 'prod') {
            lvmsg.delete()
        } else {
            if (!lvmsg.content.includes('utviklingsmodus') && environment === 'dev')
                las_vegas.send(
                    '*Botten er i utviklingsmodus, og denne kanelen er derfor midlertidig stengt. Hvis du tror dette er en feil, tag @Bot-support i #Bot-utvikling*'
                )
        }
    }
    las_vegas.permissionOverwrites.edit('340626855990132747', {
        SEND_MESSAGES: environment === 'prod',
    })
    //TODO END

    const today = new Date()
    const time = today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds()
    console.log(`Logged in as ${mazariniClient.user.tag} ${time} !`)
    if (environment == 'prod') {
        MessageHelper.sendMessageToActionLog(action_log_channel, 'Boten er nå live i production mode.')
    }
    if (args[0] == 'crashed') {
        MessageHelper.sendMessageToActionLog(action_log_channel, 'Boten har restartet selv etter et kræsj. Argument line: ' + args[0])
    }
    mazariniClient.user.setPresence({
        activity: {
            name: 'for !mz commands',
            type: 'WATCHING', //"PLAYING", "STREAMING", "WATCHING", "LISTENING"
        },
        status: 'online',
    })
    /** SCHEDULED JOBS */
    //https://www.npmjs.com/package/node-schedule
    action_log_channel = mazariniClient.channels.cache.get('810832760364859432')

    const resetMygleJob = schedule.scheduleJob('0 8 * * *', function () {
        console.log('Kjører resett av mygling: ' + new Date().toString())
        DatabaseHelper.deleteSpecificPrefixValues('mygling')
    })
    const navPenger = schedule.scheduleJob('0 8 * * 1', async function () {
        console.log('Får penger av NAV kl 08:00')
        const brukere = await DatabaseHelper.getAllUsers()
        Object.keys(brukere).forEach((username: string) => {
            const currentBalance = DatabaseHelper.getValueWithoutMessage('dogeCoin', username)
            const newBalance = Number(currentBalance) + 200
            DatabaseHelper.setValue('dogeCoin', username.toString(), newBalance.toString())
        })
    })

    const reminSpinJob = schedule.scheduleJob('0 21 * * 7', function () {
        console.log('Minner om reset')
        const las_vegas = mazariniClient.channels.cache.get('808992127249678386') as TextChannel
        if (las_vegas) {
            // MessageHelper.sendMessage(las_vegas, )
            las_vegas.send('Husk at ukens spin resetter i morgen klokken 09:00! ')
        } else {
            console.log('Fant ikke channelen las_vegas i reminSpinJob')
        }
    })

    const resetSpinJob = schedule.scheduleJob('0 9 * * 1', async function () {
        console.log('Kjører resett av spins, mandag 09:00')
        const las_vegas = mazariniClient.channels.cache.get('808992127249678386') as TextChannel
        if (!las_vegas) {
            console.log('Fant ikke last_vegas i resetSpinJob')
            return
        }
        const spinnerMention = '<@&823504322213838888>'
        const message = await las_vegas.send(spinnerMention + ', ukens spin har blitt nullstilt. Her er ukens score:\n')
        const listing = await Spinner.listScores(message, true)
        if (!listing) {
            if (las_vegas) las_vegas.send('Hvis denne meldingen kommer har ingen spunnet denne uken, eller så har Arne failet igjen')
            return
        }
        Spinner.updateATH()
        DatabaseHelper.deleteSpecificPrefixValues('spin')

        const spinnerRole = mazariniClient.guild.roles.fetch('823504322213838888')

        //TODO: Pass på at dene funker. Hvis den gjør det, kan vi unngå at den logger til action_log?
        // try {
        //     mazariniClient.members.forEach((member: GuildMember) => {
        //         member.roles.remove(spinnerRole)
        //         console.log(member.nickname)
        //     })
        //     // DatabaseHelper.find
        // } catch (error) {
        //     MessageHelper.sendMessageToActionLog(
        //         message,
        //         'Error: Klarte ikke slette rollen spinners fra alle medlemmene. Stacktrace: ' +
        //             error
        //     )
        // }
    })
    const guild = mazariniClient.guilds.cache.find((g: Guild) => g.id === '340626855990132747') as Guild
    guild.members.cache.find((member) => member.id === '802945796457758760')

    const bot = guild.members.cache.find((member) => member.id === '802945796457758760')
    bot?.setNickname(environment === 'dev' ? 'Bot Høie (TEST)' : 'Bot Høie')

    //Set username to (TEST) while on dev
    // mazariniClient.channels.guild.members
    //     .fetch('808992127249678386')
    //     .setNickname('TEST')
})

mazariniClient.on('messageCreate', async (message: Message) => {
    numMessages++
    //Do not reply to own messages
    if (message.author == mazariniClient.user) return

    if (checkForLockCommand(message)) return
    if (isThreadLocked(message)) return
    if (isUserLocked(message)) return
    if (isBotLocked()) return
    if (!isLegalChannel(message)) return
    /**  Check message for commands */
    await checkForCommand(message)

    /*
    Commands below this comment are not called, but run on each sent message. 
    */
    checkMessageForJokes(message)
})
function isLegalChannel(message: Message) {
    return (
        (environment === 'dev' &&
            (message.channel.id === '880493116648456222' || message.channel.id === '880493116648456222' || message.channel.id === '342009170318327831')) ||
        (environment === 'prod' && message.channel.id !== '880493116648456222')
    )
}

function isThreadLocked(message: Message) {
    return lockedThread.includes(message.channelId)
}

function isBotLocked() {
    return botLocked
}

function isUserLocked(message: Message) {
    return lockedUser.includes(message.author.username)
}

function checkForLockCommand(message: Message) {
    const content = message.content
    const isBot = content.includes('bot')
    const isUser = content.includes('user')
    const username = message.content.split(' ')[2] ?? ''
    let locking = true
    if (Admin.isAuthorSuperAdmin(message.member) && content.startsWith('!lock')) {
        if (isUser) {
            if (lockedUser.includes(username)) {
                lockedUser = lockedUser.filter((u) => u !== username)
                locking = false
            } else {
                lockedUser.push(username)
                locking = true
            }
        } else if (isBot) {
            botLocked = !botLocked
            locking = botLocked
        } else {
            if (lockedThread.includes(message.channelId)) {
                lockedThread = lockedThread.filter((t) => t !== message.channelId)
                locking = false
            } else {
                lockedThread.push(message.channelId)
                locking = true
            }
        }
        let reply = ''
        if (isBot) reply = `Botten er nå ${locking ? 'låst' : 'åpen'}`
        else if (isUser) reply = `${username} er nå ${locking ? 'låst' : 'åpen'} for å bruke botten`
        else reply = `Kanalen er nå ${locking ? 'låst' : 'åpen'} for svar fra botten`
        message.channel.send(reply)
        return true
    } else {
        if (content.startsWith('!lock')) message.delete()
        return false
    }
}
async function checkForCommand(message: Message) {
    if (message.author == mazariniClient.user) return
    //TODO: Hvis de @mentione botte, reply med ein random tekst?
    const isZm = message.content.toLowerCase().startsWith('!zm ')
    if (message.content.toLowerCase().startsWith('!mz ') || isZm) {
        let cmdFound = false
        const command = message.content.toLowerCase().replace('!mz ', '').replace('!mz', '').replace('!zm ', '').split(' ')[0].toLowerCase()
        const messageContent = message.content.split(' ').slice(2).join(' ') // message.content.replace("!mz " + cmd.commandName, "").replace("!Mz " + cmd.commandName, "").replace("!MZ " + cmd.commandName, "").trim()
        const args = !!messageContent ? messageContent.split(' ') : []
        if (message.content.toLowerCase().startsWith('!mz ja')) {
            const lastCommand = commands.filter((cmd) => cmd.commandName == lastUsedCommand)[0]
            if (lastCommand) {
                runCommandElement(lastCommand, message, messageContent, args)
                return
            } else {
                message.reply('Kunne ikke utføre kommandoen')
            }
            return
        }
        commands.forEach((cmd) => {
            if (command == cmd.commandName.toLowerCase()) {
                cmdFound = runCommandElement(cmd, message, messageContent, args)
            }
        })
        const kekw = await message.client.emojis.cache.find((emoji) => emoji.name == 'kekw_animated')
        if (!cmdFound) {
            const commandNames: string[] = []
            commands.forEach((el) => commandNames.push(el.commandName))
            if (kekw) message.react(kekw)
            const matched = didYouMean(command, commandNames)
            Admin.logInncorectCommandUsage(message, messageContent, args)
            if (matched) lastUsedCommand = matched
            message.reply(
                "lmao, commanden '" +
                    command +
                    "' fins ikkje <a:kekw_animated:" +
                    kekw?.id +
                    '> .' +
                    (matched ? ' Mente du **' + matched + '**?' : ' Prøv !mz help')
            )
        }
    } else if (message.content.startsWith('!mz')) {
        message.reply("du må ha mellomrom etter '!mz' og kommandoen.")
    }
    // else if (message.mentions.users.find((user) => user.id == '802945796457758760')) {
    //     message.reply(ArrayUtils.randomChoiceFromArray(globalArrays.bentHoieLines))
    // }
}

function runCommandElement(cmd: ICommandElement, message: Message, messageContent: string, args: string[]) {
    //Remove '!mz <command name>' from the content to avoid repeating this process in each function.

    if (cmd.isSuperAdmin) {
        if (Admin.isAuthorSuperAdmin(message.member)) {
            cmd.command(message, messageContent, args)
        } else {
            MessageHelper.sendMessageToActionLogWithInsufficientRightsMessage(message)
        }
    } else if (cmd.isAdmin) {
        if (Admin.isAuthorAdmin(message.member)) {
            cmd.command(message, messageContent, args)
        } else {
            MessageHelper.sendMessageToActionLogWithInsufficientRightsMessage(message)
        }
    } else {
        try {
            if (!!cmd.deprecated)
                MessageHelper.sendMessage(message, '*Denne funksjoner er markert som deprecated/utfaset. Bruk **' + cmd.deprecated + '*** *i stedet*')
            // if (environment === 'dev')
            //     MessageHelper.sendMessage(
            //         message,
            //         '***Boten er for øyeblikket i utviklingsmodus**. Det betyr at commands kan virke ustabile, og at databaseverdier ikke blir lagret.*'
            //     )
            cmd.command(message, messageContent, args)
        } catch (error) {
            //!mz maggi feiler en gang i blant, så prøver å fange den og printe stacktrace i action_log.
            MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
        }
    }
    return true
}
/** Checks for pølse, eivindpride etc. */
function checkMessageForJokes(message: Message) {
    const kekw = message.client.emojis.cache.find((emoji) => emoji.name == 'kekw_animated')
    let matches
    let polseCounter = 0
    polseRegex.lastIndex = 0

    while ((matches = polseRegex.exec(message.content))) {
        if (matches) {
            polseCounter++
        }
    }

    if (message.attachments) {
        if (polseRegex.exec(message.attachments.first()?.name ?? '')) polseCounter++
    }

    if (polseCounter > 0) message.channel.send('Hæ, ' + (polseCounter > 1 ? polseCounter + ' ' : '') + 'pølse' + (polseCounter > 1 ? 'r' : '') + '?')

    //If eivind, eivindpride him
    if (message.author.id == '239154365443604480' && message.guild) {
        const react = message.guild.emojis.cache.find((emoji) => emoji.name == 'eivindpride')
        //check for 10% chance of eivindpriding
        if (doesThisMessageNeedAnEivindPride(message.content, polseCounter) && react) message.react(react)
    }
    if (message.author.id == '733320780707790898' && message.guild && message.mentions.roles.find((e) => e.name == 'Jævla Drittspel')) {
        //"733320780707790898" joiij
        message.react(kekw ?? '😂')
        message.reply('lol')
    }
    const idJoke = MessageUtils.doesMessageIdHaveCoolNumber(message)
    if (idJoke == '1337') {
        message.reply('nice, id-en te meldingen din inneholde 1337. Gz, du har vonne 100 coins')
        DatabaseHelper.incrementValue('dogeCoin', message.author.username, '100')
    }
}

/** Login client */
if (discordSecret.includes('insert')) throw new TypeError('**FEIL** Klienten mangler Discord Secret Token i client-env.ts')
else mazariniClient.login(discordSecret)

mazariniClient.on('reconnecting', function () {
    console.log(`client tries to reconnect to the WebSocket`)
})
mazariniClient.on('disconnect', function () {
    console.log(`WS disconnected`)
})
mazariniClient.on('error', function (error: any) {
    console.error(`client's WebSocket encountered a connection error: ${error}`)
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
    const msg = await MessageHelper.sendMessageToSpecificChannel(
        '340626855990132747',
        'Welcome to the Gulag, ' +
            (member.nickname ?? member.displayName) +
            '. Du kan gi deg selv roller ved å reagere med emojiene nedenfor for de spillene du ønsker.',
        member.guild.channels.cache.get('340626855990132747') as TextChannel
    )
    UserCommands.roleAssignment(msg, '', ['args'])
    MessageHelper.sendMessageToActionLog(
        member.guild.channels.cache.first() as TextChannel,
        'En bruker ble med i Mazarini: ' + (member.nickname ?? member.displayName)
    )
})
mazariniClient.on('guildMemberRemove', function (member: GuildMember) {
    MessageHelper.sendMessageToSpecificChannel(
        '340626855990132747',
        'Farvell, ' + (member.nickname ?? member.displayName),
        member.guild.channels.cache.get('340626855990132747') as TextChannel
    )
    MessageHelper.sendMessageToActionLog(
        member.guild.channels.cache.first() as TextChannel,
        'En bruker forlot Mazarini: ' + (member.nickname ?? member.displayName)
    )
})

/** TODO START */

//User detail (brukerspesifikt, ikke i selve discordserver)
//eksempel: Brukernavn#0001, profilbilde osv.

//TODO: Sjekk cases og finn ut hva som er endret
mazariniClient.on('userUpdate', function (oldUser: User, newUser: User) {
    MessageHelper.sendMessageToActionLog(
        newUser.client.channels.cache.first() as TextChannel,
        'Oppdatert bruker1:   ' + (oldUser.tag ?? oldUser.username) + ' -> ' + (newUser.tag ?? newUser.username) + ''
    )
})

//Emitted whenever a guild member changes - i.e. new role, removed role, nickname.
mazariniClient.on('guildMemberUpdate', function (oldMember: GuildMember, newMember: GuildMember) {
    if (newMember.id === '802945796457758760') return //Ikke gjør noe når bot oppdateres
    if (oldMember.id === '802945796457758760') return
    if (oldMember.user.username === 'MazariniBot') return
    const diffCalc = diff.diff
    const differences = diff(oldMember, newMember)
    const whatChanged = compareMember(oldMember, newMember)

    let changesString = ''
    if (differences) {
        differences.forEach((change: any, index: number) => {
            changesString += change.path + (index == differences.length ? ' ' : ',')
        })
        MessageHelper.sendMessageToActionLog(
            newMember.client.channels.cache.first() as TextChannel,
            'Oppdatert bruker ' + (oldMember.nickname ?? oldMember.displayName) + ': ' + whatChanged + '.'
        )
    }
})

/** TODO END */

mazariniClient.on('roleCreate', function (role: Role) {
    MessageHelper.sendMessageToActionLog(role.guild.channels.cache.first() as TextChannel, 'En ny rolle er opprettet: ' + role.name)
})
mazariniClient.on('roleDelete', function (role: Role) {
    MessageHelper.sendMessageToActionLog(role.guild.channels.cache.first() as TextChannel, 'En rolle er slettet: ' + role.name)
})

mazariniClient.on('roleUpdate', function (oldRole: Role, newRole: Role) {
    // MessageHelper.sendMessageToActionLog(newRole.guild.channels.cache.first() as TextChannel, "Rollen " + newRole.name + " ble oppdatert.")
})

mazariniClient.on('messageDelete', function (message: Message) {
    //Ikke i bruk
})
mazariniClient.on('messageUpdate', function (oldMessage: Message, newMessage: Message) {
    checkForCommand(newMessage)
    checkMessageForJokes(newMessage)
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

function compareMember(oldMember: GuildMember, newMember: GuildMember) {
    if (newMember.id === '802945796457758760') return //Ikke gjør noe når bot oppdateres
    if (oldMember.id === '802945796457758760') return

    const roles = oldMember.roles.cache
    const role = roleArraysEqual([...oldMember.roles.cache.values()], [...newMember.roles.cache.values()])
    if (role) {
        return 'role: ' + role.name
    }
    if (oldMember.nickname !== newMember.nickname)
        return 'nickname: ' + (oldMember.nickname ?? oldMember.displayName) + ' endret til ' + (newMember.nickname ?? newMember.displayName)
    if (oldMember.user.username !== newMember.user.username) return 'username'

    //TODO: Sjekk etter andre ting?
    if (oldMember.nickname !== newMember.nickname) return 'nickname'
    if (oldMember.nickname !== newMember.nickname) return 'nickname'
}

function roleArraysEqual(a: any[], b: any[]) {
    if (a === b) return undefined
    if (a == null || b == null) return undefined

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
            if (a.length > b.length) return a[i] as Role
            else return b[i] as Role
        }
    }
    return undefined
}

export class Index {
    static readonly getWZStats: ICommandElement = {
        commandName: 'ja',
        description: "Utfør siste kommando på ny (eller utfør kommandoen fra 'mente du...'",
        command: (rawMessage: Message, messageContent: string) => {},
        category: 'annet',
    }
}
