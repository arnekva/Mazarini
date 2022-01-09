import didYouMean from 'didyoumean2'
import { Message } from 'discord.js'
import { Admin } from '../admin/admin'
import { environment } from '../client-env'
import { commands, ICommandElement } from '../commands/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { MessageUtils } from '../utils/messageUtils'
import { doesThisMessageNeedAnEivindPride } from '../utils/miscUtils'
import { getRandomPercentage } from '../utils/randomUtils'

export class CommandRunner {
    static botLocked: boolean = false
    static lockedUser: string[] = []
    static lockedThread: string[] = []
    static lastUsedCommand = 'help'
    static polseRegex = new RegExp(/(p)(ø|ö|y|e|o|a|u|i|ô|ò|ó|â|ê|å|æ|ê|è|é|à|á)*(ls)(e|a|å|o|i)|(pause)|(🌭)|(hotdog)|(sausage)|(hot-dog)/gi)

    static checkForLockCommand(message: Message) {
        const content = message.content
        const isBot = content.includes('bot')
        const isUser = content.includes('user')
        const username = message.content.split(' ')[2] ?? ''
        let locking = true
        if (Admin.isAuthorSuperAdmin(message.member) && content.startsWith('!lock')) {
            if (isUser) {
                if (this.lockedUser.includes(username)) {
                    this.lockedUser = this.lockedUser.filter((u) => u !== username)
                    locking = false
                } else {
                    this.lockedUser.push(username)
                    locking = true
                }
            } else if (isBot) {
                this.botLocked = !this.botLocked
                locking = this.botLocked
            } else {
                if (this.lockedThread.includes(message.channelId)) {
                    this.lockedThread = this.lockedThread.filter((t) => t !== message.channelId)
                    locking = false
                } else {
                    this.lockedThread.push(message.channelId)
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
            return false
        }
    }
    static async checkForCommand(message: Message) {
        if (message.author.id === '802945796457758760') return

        const isZm = message.content.toLowerCase().startsWith('!zm ')
        if (message.content.toLowerCase().startsWith('!mz ') || isZm) {
            if (getRandomPercentage(1)) {
                message.reply('Du, det orke eg ikkje akkurat nå 🤷')
                return
            }

            let cmdFound = false
            const command = message.content.toLowerCase().replace('!mz ', '').replace('!mz', '').replace('!zm ', '').split(' ')[0].toLowerCase()
            const messageContent = message.content.split(' ').slice(2).join(' ')
            const args = !!messageContent ? messageContent.split(' ') : []
            if (message.content.toLowerCase().startsWith('!mz ja')) {
                const lastCommand = commands.filter((cmd) => cmd.commandName == this.lastUsedCommand)[0]
                if (lastCommand) {
                    this.runCommandElement(lastCommand, message, messageContent, args)
                    return
                } else {
                    message.reply('Kunne ikke utføre kommandoen')
                }
                return
            }
            commands.forEach((cmd) => {
                if (command == cmd.commandName.toLowerCase()) {
                    cmdFound = this.runCommandElement(cmd, message, messageContent, args)
                }
            })
            const kekw = await message.client.emojis.cache.find((emoji) => emoji.name == 'kekw_animated')
            if (!cmdFound) {
                const commandNames: string[] = []
                commands.forEach((el) => commandNames.push(el.commandName))
                if (kekw) message.react(kekw)
                const matched = didYouMean(command, commandNames)
                Admin.logInncorectCommandUsage(message, messageContent, args)
                if (matched) this.lastUsedCommand = matched
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
    }

    static runCommandElement(cmd: ICommandElement, message: Message, messageContent: string, args: string[]) {
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

                cmd.command(message, messageContent, args)
            } catch (error) {
                MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
            }
        }
        return true
    }

    /** Checks for pølse, eivindpride etc. */
    static checkMessageForJokes(message: Message) {
        const kekw = message.client.emojis.cache.find((emoji) => emoji.name == 'kekw_animated')
        let matches
        let polseCounter = 0
        this.polseRegex.lastIndex = 0
        while ((matches = this.polseRegex.exec(message.content))) {
            if (matches) {
                polseCounter++
            }
        }

        if (message.attachments) {
            if (this.polseRegex.exec(message.attachments.first()?.name ?? '')) polseCounter++
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
            message.reply('nice, id-en te meldingen din inneholde 1337. Gz, du har vonne 100 coins og 5.000 chips')
            DatabaseHelper.incrementValue('dogeCoin', message.author.username, '100')
            DatabaseHelper.incrementValue('chips', message.author.username, '5000')
        }
    }

    static isThreadLocked(message: Message) {
        return this.lockedThread.includes(message.channelId)
    }

    static isBotLocked() {
        return this.botLocked
    }

    static isUserLocked(message: Message) {
        return this.lockedUser.includes(message.author.username)
    }

    static isLegalChannel(message: Message) {
        return (
            (environment === 'dev' &&
                (message.channel.id === '880493116648456222' ||
                    message.channel.id === '880493116648456222' ||
                    message.channel.id === '342009170318327831' ||
                    message.channel.id === '778599907933159434')) ||
            (environment === 'prod' && message.channel.id !== '880493116648456222')
        )
    }
}
