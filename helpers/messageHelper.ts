import { Client, DMChannel, Message, MessageEmbed, TextChannel, User } from 'discord.js'
import { globalArrays } from '../globals'
import { ArrayUtils } from '../utils/arrayUtils'
import { CollectorUtils } from '../utils/collectorUtils'
import { MessageUtils } from '../utils/messageUtils'
import { UserUtils } from '../utils/userUtils'

export type typeOfError = 'unauthorized' | 'error' | 'warning'
export type thumbsReact = 'up' | 'down'

interface DMParams {
    userID?: string
    username?: string
}
export class MessageHelper {
    private client: Client
    botSupport = '863038817794392106'
    constructor(client: Client) {
        this.client = client
    }

    sendMessage(channelId: string, message: string) {
        if (!this.checkForEmptyMessage(message)) {
            return this.logEmptyMessage('En melding som ble forsøkt sendt var tom', channelId)
        }
        const channel = this.findChannelById(channelId) as TextChannel
        if (channel) return channel.send(message)
        return undefined
    }

    checkForEmptyMessage(s: string) {
        return !!s.trim()
    }

    sendMessageToChannel(channel: TextChannel | DMChannel, message: string) {
        if (!this.checkForEmptyMessage(message)) {
            return this.logEmptyMessage('En melding som ble forsøkt sendt var tom', channel.id)
        }
        return channel.send(message)
    }

    sendDM(user: User, message: string) {
        if (!this.checkForEmptyMessage(message)) {
            return undefined
        }
        user.send(message)
    }

    reactWithThumbs(message: Message, reaction: thumbsReact) {
        message.react(reaction === 'up' ? '👍' : '👎')
    }

    reactWithCheckmark(message: Message) {
        message.react('✅')
    }

    findChannelById(id: string) {
        return this.client.channels.cache.find((c) => c.id === id)
    }

    reactWithRandomEmoji(message: Message) {
        message.react(ArrayUtils.randomChoiceFromArray(globalArrays.emojiesList))
    }

    /** Reply til en gitt melding med gitt string. */
    replyToMessage(message: Message, errormessage: string) {
        message.reply(errormessage)
    }

    /** Reply når feil formattering er brukt. Send inn hvilken formattering som skal brukes */
    replyFormattingError(message: Message, errormessage: string) {
        message.reply('du har brukt feil formattering. Bruk: ' + errormessage)
    }

    static async findMessageById(rawMessage: Message, id: string): Promise<Message<boolean> | undefined> {
        const allChannels = [...rawMessage.client.channels.cache.values()].filter((channel) => channel instanceof TextChannel) as TextChannel[]
        let messageToReturn

        for (const channel of allChannels) {
            if (channel) {
                await channel.messages
                    .fetch(id)
                    .then((message) => {
                        if (message.guild) {
                            messageToReturn = message
                        }
                    })
                    .catch((error: any) => {
                        //ikke catch noe, den thrower exception hvis meldingen ikke finnes (noe den ikke skal gjøre i 9/10 channels)
                        // MessageHelper.sendMessageToActionLogWithDefaultMessage(rawMessage, error);
                    })
            }
        }
        return messageToReturn
    }
    /** Send en embedded message (se gambling for eksempel) */

    async sendFormattedMessage(channel: TextChannel, newMessage: MessageEmbed) {
        return channel.send({ embeds: [newMessage] })
    }

    sendMessageToActionLog(channel: TextChannel, msg: string) {
        const errorChannel = channel.client.channels.cache.get('810832760364859432') as TextChannel
        errorChannel.send(msg)
    }

    logEmptyMessage(errorMessageToSend: string, channelId: string) {
        const errorChannel = this.client.channels.cache.get('810832760364859432') as TextChannel
        const replyChannel = this.client.channels.cache.get(channelId)
        errorChannel.send(
            `En tom melding ble forsøkt sendt. Forsøkte å sende til channel-ID ${channelId}. Channel-object er: ${
                replyChannel ? replyChannel.toString() : 'ingen'
            }.`
        )
        if (replyChannel && replyChannel.isText())
            return replyChannel.send(`${errorMessageToSend} ${MessageUtils.getRoleTagString(UserUtils.ROLE_IDs.BUT_SUPPORT)}`)
    }

    async sendMessageToActionLogWithDefaultMessage(message: Message, error: any) {
        // if (!ignoreReply) message.reply(`En feil har oppstått. Feilkoden og meldingen din blir logget. <@&${this.botSupport}>`)
        const replyMsg = await message.reply(`En feil har oppstått. Feilkoden og meldingen din blir logget. (Reager med tommel opp for å tagge Bot-support)`)
        this.reactWithThumbs(replyMsg, 'up')
        const collector = replyMsg.createReactionCollector()
        collector.on('collect', (reaction) => {
            if (CollectorUtils.shouldStopCollector(reaction, message)) collector.stop()

            if (reaction.emoji.name === '👍' && reaction.users.cache.find((u) => u.username === message.author.username)) {
                replyMsg.edit(`En feil har oppstått. Feilkoden og meldingen din blir logget.  ${MessageUtils.getRoleTagString(UserUtils.ROLE_IDs.BUT_SUPPORT)}`)
                collector.stop()
            }
        })
        const errorChannel = message.channel.client.channels.cache.get('810832760364859432') as TextChannel
        errorChannel.send(
            `En feil har oppstått i en melding fra ${message.author.username}. Meldingsinnhold: <${message.content}>. Channel: ${message.channel}. Feilmelding: <${error}>`
        )
    }

    async sendMessageToActionLogWithCustomMessage(message: Message, error: any, reply: string, includeSupportTag?: boolean) {
        //Arne
        const replyMsg = await message.reply(`${reply} ${includeSupportTag ? '(Reager med tommel opp for å tagge Bot-support)' : ''}`)
        this.reactWithThumbs(replyMsg, 'up')
        const collector = replyMsg.createReactionCollector()
        collector.on('collect', (reaction) => {
            if (CollectorUtils.shouldStopCollector(reaction, message)) collector.stop()

            if (reaction.emoji.name === '👍' && reaction.users.cache.find((u) => u.username === message.author.username)) {
                replyMsg.edit(`${reply} ${includeSupportTag ? MessageUtils.getRoleTagString(UserUtils.ROLE_IDs.BUT_SUPPORT) : ''}`)
                collector.stop()
            }
        })
        const errorChannel = message.channel.client.channels.cache.get('810832760364859432') as TextChannel
        errorChannel.send(
            `En feil har oppstått i en melding fra ${message.author.username}. Meldingsinnhold: <${message.content}>. Channel: ${message.channel}. Feilmelding: <${error}>`
        )
    }

    sendMessageToActionLogWithInsufficientRightsMessage(message: Message, extra?: any, ignoreReply?: boolean) {
        message.reply(`Du har ikke de nødvendige rettighetene for å bruke denne funksjonen. ${MessageUtils.getRoleTagString(UserUtils.ROLE_IDs.BUT_SUPPORT)}`)
        const errorChannel = message.channel.client.channels.cache.get('810832760364859432') as TextChannel
        errorChannel.send(
            `${message.author.username} forsøkte å bruke en funksjon uten rettigheter. Meldingsinnhold: <${message.content}>. Channel: ${message.channel}. ${extra}`
        )
    }

    sendMessageToBotUtvikling(channel: TextChannel, message: string) {
        const errorChannel = channel.client.channels.cache.get('802716150484041751') as TextChannel
        errorChannel.send(message)
    }
}
