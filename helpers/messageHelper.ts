import {
    ActionRowData,
    APIActionRowComponent,
    APIAttachment,
    APIMessageActionRowComponent,
    Attachment,
    AttachmentBuilder,
    AttachmentPayload,
    BitFieldResolvable,
    BufferResolvable,
    ButtonInteraction,
    CacheType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    InteractionEditReplyOptions,
    InteractionReplyOptions,
    InteractionResponse,
    JSONEncodable,
    Message,
    MessageActionRowComponentBuilder,
    MessageActionRowComponentData,
    MessageCreateOptions,
    MessageFlags,
    MessageFlagsString,
    ModalSubmitInteraction,
    RepliableInteraction,
    SelectMenuInteraction,
    TextChannel,
    User,
} from 'discord.js'
import { Moment } from 'moment'
import { Stream } from 'stream'
import { environment } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'
import { MazariniBot } from '../main'
import { ChannelIds, MentionUtils } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'

export type typeOfError = 'unauthorized' | 'error' | 'warning'
export type thumbsReact = 'up' | 'down'

interface DMParams {
    userID?: string
    username?: string
}

interface IMessageOptions {
    /** Set this to true to be able to mention users without notifying them */
    noMentions?: boolean
    /** Settings this to true will send the message without users getting a sound notification. A new message icon (circle) will still appear */
    sendAsSilent?: boolean
    /** This will allow you to send links without an embed preview automatically showing. */
    supressEmbeds?: boolean
    /** This will make the message NOT count towards MazariniClient.numMessagesFromBot. Used when e.g. it's an error message being sent, as this increments numErrorMessages instead */
    dontIncrementMessageCounter?: boolean
    /** Set to true to make a message be sent as tts. Text will appear as normal, but text will be read loud by TTS.  */
    tts?: boolean
}
interface IInteractionOptions {
    /** Make the reply only visible to the engager */
    ephemeral?: boolean
    /** If the interaction has been defered, this option MUST be set for the reply to work. This will edit the reply instead of attempting to send a new answer */
    hasBeenDefered?: boolean
}

interface IMessageContent {
    text?: string
    embed?: EmbedBuilder
    files?: MessageFiles
    components?: MessageCompontent
}

type MessageCompontent = (
    | JSONEncodable<APIActionRowComponent<APIMessageActionRowComponent>>
    | ActionRowData<MessageActionRowComponentData | MessageActionRowComponentBuilder>
    | APIActionRowComponent<APIMessageActionRowComponent>
)[]

type MessageFiles = (BufferResolvable | Stream | JSONEncodable<APIAttachment> | Attachment | AttachmentBuilder | AttachmentPayload)[]

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
    {
        [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
    }[Keys]

export class MessageHelper {
    private client: MazariniClient

    constructor(client: MazariniClient) {
        this.client = client
    }

    /**
     * The best way to reply to an interaction. If the wait time is longer than 3 seconds, it must be defered first with interaction.deferReply(). If defered, please add the the option param for it, otherwise it will throw an error
     * @param interaction The interaction to reply to.
     * @param messageContent The content to send. Can be a string or an embed
     * @param options Options for the message - if message has been defered, it must be set in this
     * @param components Components to send, i.e. action rows
     * @param files Any files to attach to the message. Use the AttachmentBuilder for this. I.e. ```new AttachmentBuilder("https://placeholder.com/square120x120.png", {name: "square.png"})```
     * @returns True if the message was sent succesfully, false if an error occured.
     */
    async replyToInteraction(
        interaction:
            | ChatInputCommandInteraction<CacheType>
            | ModalSubmitInteraction<CacheType>
            | SelectMenuInteraction<CacheType>
            | ButtonInteraction<CacheType>
            | RepliableInteraction<CacheType>,
        messageContent: string | EmbedBuilder,
        options?: IInteractionOptions,
        components?: MessageCompontent,
        files?: MessageFiles
    ): Promise<InteractionResponse<boolean> | Message<boolean>> {
        const handleError = async (e: any) => {
            let msg: Message<boolean> | undefined
            if (options?.ephemeral) {
                this.sendDM(interaction.user, messageContent)
            } else {
                if (typeof messageContent === 'object') msg = await this.sendMessage(interaction?.channelId, { embed: messageContent })
                else msg = await this.sendMessage(interaction?.channelId, { text: `${MentionUtils.mentionUser(interaction.user.id)} ${messageContent}` })
            }

            let msgInfo = msg
                ? `Sendte en ${options?.ephemeral ? 'DM' : 'separat melding'} i stedet for interaksjonssvar.`
                : `Klarte heller ikke sende separat melding som svar`
            if (options?.ephemeral) msgInfo += `\nMelding var ephemeral, så svaret ble sendt på DM`
            if (environment !== 'dev') {
                let commandName: string | undefined = undefined
                if (interaction.isChatInputCommand()) commandName = interaction.commandName
                else if (interaction.isButton()) commandName = interaction.customId
                else if (interaction.isAnySelectMenu()) commandName = interaction.customId
                else if (interaction.isModalSubmit()) commandName = interaction.customId
                this.sendLogMessage(
                    `${interaction.user.username} prøvde å bruke ${
                        commandName ? commandName : '<MANGLER CASE FOR DENNE TYPE COMMAND>'
                    } i kanalen ${MentionUtils.mentionChannel(interaction?.channelId)}, men den feilet. ${msgInfo}`
                )
            }
            return false
        }
        if (!interaction.replied) {
            const payload: InteractionEditReplyOptions = {}

            payload.components = components
            payload.files = files
            let reply: InteractionResponse<boolean> | Message<boolean> | undefined = undefined
            if (typeof messageContent === 'object') {
                payload.embeds = [messageContent]
            } else {
                payload.content = messageContent
            }
            if (options?.hasBeenDefered) {
                const r = await interaction.editReply(payload).catch((e) => handleError(e))
                if (r instanceof Message) reply = r
            } else {
                const payloadAsReply = payload as InteractionReplyOptions
                payloadAsReply.ephemeral = !!options?.ephemeral
                const r = await interaction.reply(payloadAsReply).catch((e) => handleError(e))
                if (r instanceof InteractionResponse) reply = r
            }
            MazariniBot.numMessagesFromBot++
            return reply
        }

        return undefined
    }

    /**
     *
     * @param channelId Id of channel to send the message to
     * @param content Text or Embed MUST be sent in, as the message sent must have text. If they are not added, an error will be thrown when the message is sent. Components or files are also added here
     * @param options Options for the message, such as sending it as silent etc.
     * @returns a message if sent succesfully, undefined if error log message is sent
     */
    sendMessage(channelId: string, content: RequireAtLeastOne<IMessageContent, 'text' | 'embed'>, options?: IMessageOptions): Promise<Message | undefined> {
        //
        if (!!content.text && !this.messageHasContent(content.text)) {
            this.sendLogMessage('En melding som ble forsøkt sendt var tom')
            return undefined
        }

        const channel = this.findChannelById(channelId) as TextChannel
        if (channel && channel.permissionsFor(UserUtils.findMemberByUserID(MentionUtils.User_IDs.BOT_HOIE, channel.guild)).toArray().includes('SendMessages')) {
            if (content.text && content.text.length >= 2000) {
                this.sendLogMessage(`En melding med flere enn 2000 tegn ble forsøkt sendt. Meldingen blir splittet`)
                const msgArr = content.text.match(/[\s\S]{1,1800}/g)
                msgArr.forEach((msg, ind) => {
                    if (!options?.dontIncrementMessageCounter) MazariniBot.numMessagesFromBot++
                    channel.send(msg)
                })
                return undefined
            } else {
                const messageOptions = { content: content.text } as MessageCreateOptions
                if (options?.noMentions) {
                    messageOptions.allowedMentions = {
                        roles: [],
                        users: [],
                        repliedUser: true,
                    }
                }
                messageOptions.content = content.text
                if (content.embed) messageOptions.embeds = [content.embed]
                if (content.components) messageOptions.components = content.components
                if (content.files) messageOptions.files = content.files

                const flags = [] as BitFieldResolvable<
                    Extract<MessageFlagsString, 'SuppressEmbeds' | 'SuppressNotifications'>,
                    MessageFlags.SuppressEmbeds | MessageFlags.SuppressNotifications
                >[]

                if (options?.sendAsSilent) {
                    flags.push('SuppressNotifications')
                }
                if (options?.supressEmbeds) {
                    flags.push('SuppressEmbeds')
                }
                if (options?.tts) {
                    messageOptions.tts = true
                }
                messageOptions.flags = flags
                if (!options?.dontIncrementMessageCounter) MazariniBot.numMessagesFromBot++
                return channel.send(messageOptions)
            }
        }
        return undefined
    }

    private messageHasContent(s: string) {
        return !!s.trim()
    }

    sendDM(user: User, message: string | EmbedBuilder) {
        if (typeof message === 'object') {
            message.addFields({
                name: 'Usynlig',
                value: 'Du brukte en interaction, men botten klarte ikke svare på den. Siden svaret skulle vært usynlig får du en DM heller',
            })
            user.send({
                embeds: [message],
            })
        } else {
            message += `\n\nDu brukte en interaction, men botten klarte ikke svare på den. Siden svaret skulle vært usynlig får du en DM heller`
            user.send({
                content: message,
            })
        }
    }

    private findChannelById(id: string) {
        return this.client.channels.cache.find((c) => c.id === id)
    }

    /** Reply to a given message */
    replyToMessage(message: Message, content: string, options?: IMessageOptions) {
        const flags = [] as BitFieldResolvable<
            Extract<MessageFlagsString, 'SuppressEmbeds' | 'SuppressNotifications'>,
            MessageFlags.SuppressEmbeds | MessageFlags.SuppressNotifications
        >[]

        const messageOptions = { content: content } as MessageCreateOptions
        if (options?.noMentions) {
            messageOptions.allowedMentions = {
                roles: [],
                users: [],
                repliedUser: true,
            }
        }
        if (options?.sendAsSilent) {
            flags.push('SuppressNotifications')
        }
        if (options?.supressEmbeds) {
            flags.push('SuppressEmbeds')
        }
        messageOptions.flags = flags
        message.reply(messageOptions)
    }

    sendLogMessage(msg: string, options?: IMessageOptions) {
        MazariniBot.numMessagesNumErrorMessages++
        options ? (options.dontIncrementMessageCounter = true) : (options = { dontIncrementMessageCounter: true })

        return this.sendMessage(ChannelIds.ACTION_LOG, { text: msg }, options)
    }

    async scheduleMessage(msg: string, channelId: string, date: Moment) {
        const storage = await this.client.db.getStorage()
        if (!storage?.scheduledMessages) {
            storage['scheduledMessages'] = []
        }
        if (storage?.scheduledMessages) {
            storage.scheduledMessages.push({ message: msg, dateToSendOn: date.unix(), channelId: channelId })
        }
        this.client.db.updateStorage({
            scheduledMessages: storage.scheduledMessages,
        })
    }
}
