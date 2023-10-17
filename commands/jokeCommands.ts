import { APIEmbedField, CacheType, ChatInputCommandInteraction, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { DateUtils } from '../utils/dateUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { MentionUtils } from '../utils/mentionUtils'
import { MiscUtils } from '../utils/miscUtils'
import { textArrays } from '../utils/textArrays'
import { UserUtils } from '../utils/userUtils'

export class JokeCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private async mordi(interaction: ChatInputCommandInteraction<CacheType>) {
        const emoji = await EmojiHelper.getEmoji('eyebrows', interaction)
        this.messageHelper.replyToInteraction(interaction, Math.random() > 0.05 ? `E nais ${emoji.id}` : `E skamnais :eyebrows: ${emoji.id}`)
    }

    private async findUserActivity(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const paramUser = interaction.options.get('bruker')?.user

        const member = UserUtils.findMemberByUserID(paramUser.id, interaction)
        if (member && member?.presence && member?.presence?.clientStatus) {
            if (member.presence.activities && member.presence.activities[0]) {
                const activities = member.presence.activities.filter((a) =>
                    member.id === MentionUtils.User_IDs.BOT_HOIE ? a : a.name.toLowerCase() !== 'custom status'
                )
                let currentActivity = activities[0]
                if (activities.length > 0) {
                    //Need a flag to check if current activity is Spotify. Spotify supplies album name in asset but artist/song in state/details, so asset should not override description
                    let isSpotify = false
                    if (currentActivity.name.toLowerCase() === 'spotify') {
                        isSpotify = activities[1] ? false : true
                        currentActivity = activities[1] ?? currentActivity
                    }
                    const baseURL = `https://cdn.discordapp.com/app-assets/${currentActivity.applicationId}`

                    const timeSince = DateUtils.getTimeSince(currentActivity.timestamps?.start ?? new Date())
                    const embd = EmbedUtils.createSimpleEmbed(
                        `${member.user.username} - ${currentActivity.name}`,
                        `${currentActivity?.details ?? ''} ${currentActivity.state ? ' - ' + currentActivity?.state : ''}`,
                        [{ name: 'Åpent i', value: timeSince ? `${timeSince.hours} timer og ${timeSince.minutes} minutter` : 'Ane ikkje' }]
                    )

                    if (currentActivity.url) embd.setThumbnail(`${currentActivity.url}`)
                    if (currentActivity.assets) {
                        const urlSlashFix = currentActivity.assets.largeImage ? currentActivity.assets.largeImage.replace('https/', 'https://') : ''
                        const urlMatch = urlSlashFix.match(/\bhttps?:\/\/\S+/gi)
                        if (isSpotify) {
                            embd.addFields([{ name: 'Album', value: `${currentActivity.assets.largeText}` }])
                        } else if (currentActivity.assets.largeText && currentActivity.name !== 'All The Mods 7')
                            embd.setDescription(`${currentActivity.assets.largeText}`)

                        if (urlMatch) embd.setThumbnail(`${urlMatch}`)
                        else if (currentActivity.assets?.largeImage) {
                            embd.setThumbnail(`${baseURL}/${currentActivity.assets.largeImage}`)
                        } else if (currentActivity.assets?.smallImage) {
                            embd.setThumbnail(`${baseURL}/${currentActivity.assets.smallImage}`)
                        }
                    }
                    if (activities.length > 1) {
                        const rest = activities

                        const otherActivities: APIEmbedField[] = rest
                            .filter((a) => a.name !== currentActivity.name)
                            .map((a) => {
                                return { name: a.name, value: `${a?.state && a?.details ? a.state + ', ' + a.details : 'Ingen informasjon'}` }
                            })
                        embd.addFields(otherActivities)
                    }
                    this.messageHelper.replyToInteraction(interaction, embd, { hasBeenDefered: true })
                } else {
                    this.messageHelper.replyToInteraction(interaction, `Drive ikkje me någe spess`, { hasBeenDefered: true })
                }
            } else {
                this.messageHelper.replyToInteraction(interaction, 'Ingen aktivitet registrert på Discord.', { hasBeenDefered: true })
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Fant ikke brukeren. Husk at du må bruke **brukernavn** og *ikke* display name', {
                ephemeral: true,
                hasBeenDefered: true,
            })
        }
    }

    private async reactToManyMessages(interaction: ChatInputCommandInteraction<CacheType>, emojiName: string) {
        this.messageHelper.replyToInteraction(interaction, 'Eivindprider sendt', { ephemeral: true })
        try {
            const channel = interaction?.channel as TextChannel
            const react = interaction.guild?.emojis.cache.find((emoji) => emoji.name == emojiName)

            if (interaction.client) {
                channel.messages
                    .fetch({ limit: 15 })
                    .then((el) => {
                        el.forEach((message) => {
                            if (react) message.react(react)
                        })
                    })
                    .catch((error: any) => {})
            }
        } catch (error) {}
        if (interaction.guild) {
            const react = interaction.guild.emojis.cache.find((emoji) => emoji.name == 'eivindpride')
            if (react) {
            }
        }
    }

    private async reactWithLetters(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        const text = interaction.options.get('melding')?.value as string
        const msgId = interaction.options.get('melding-id')?.value as string

        let letterTab: string[] = text.split('')

        let messageToReactTo = await this.messageHelper.findMessageById(msgId)
        if (!messageToReactTo) this.messageHelper.replyToInteraction(interaction, `Fant kje meldingen bro`, { ephemeral: true, hasBeenDefered: true })

        let usedLetter = ''
        let spaceCounter = 0
        letterTab.forEach((letter: string) => {
            if (usedLetter.includes(letter) && letter == ' ') {
                spaceCounter++
            }
            const emoji = usedLetter.includes(letter) ? MiscUtils.findLetterEmoji(letter, true, spaceCounter) : MiscUtils.findLetterEmoji(letter)
            usedLetter += letter
            try {
                messageToReactTo.react(emoji).catch((error) => console.log(error))
            } catch (error) {
                console.log(error)
            }
        })
    }

    private async uWuIfyer(interaction: ChatInputCommandInteraction<CacheType>) {
        const id = interaction.options.get('melding-id')?.value as string
        this.messageHelper.replyToInteraction(interaction, 'Prøver å uwu-ifye meldingen hvis jeg finner den', { ephemeral: true })
        if (id && !isNaN(Number(id))) {
            const msgToUwU = await this.messageHelper.findMessageById(id)
            if (msgToUwU) {
                const uwuIfiedText = JokeCommands.uwuText(msgToUwU.content)
                this.messageHelper.sendMessage(interaction?.channelId, uwuIfiedText)
            }
        }
    }

    private harFese(interaction: ChatInputCommandInteraction<CacheType>) {
        const channel = interaction?.channel as TextChannel
        const role = this.getRoleBasedOnChannel(interaction?.channelId)

        const randomUser = role ? channel.members.filter((m) => m.roles.cache.get(role) !== undefined).random() : channel.members.random()
        const authorName = interaction.user.username
        const randomName = randomUser.user.username
        const phese = MiscUtils.findFeseText(authorName, randomName)
        const reply = `${phese}`

        this.messageHelper.replyToInteraction(interaction, reply)
    }

    private getRoleBasedOnChannel(channelId: string) {
        switch (channelId) {
            case '705864445338845265':
                return '735253573025267883' //Cod
            case '822998979943071824':
                return '822999208445083668' //Valheim
            default:
                return undefined
        }
    }

    private async sendBonk(interaction: ChatInputCommandInteraction<CacheType>) {
        const img = ArrayUtils.randomChoiceFromArray(textArrays.bonkMemeUrls)
        const user = interaction.options.get('bruker')?.user

        let bkCounter = 0

        const dbUser = DatabaseHelper.getUser(user.id)
        bkCounter = dbUser.bonkCounter
        dbUser.bonkCounter++

        bkCounter++
        this.messageHelper.replyToInteraction(
            interaction,
            user.username + ', du har blitt bonket. (' + `${bkCounter} ${bkCounter == 1 ? 'gang' : 'ganger'}) ` + img
        )
        if (textArrays.jailBonkMemeUrls.includes(img)) {
            const prevSentence = dbUser.jail?.daysInJail
            if (!prevSentence)
                dbUser.jail = {
                    daysInJail: 1,
                    jailState: 'standard',
                }
            if (!dbUser.jail) dbUser.jail = {}
            dbUser.jail.daysInJail = prevSentence && !isNaN(prevSentence) && prevSentence > 0 ? prevSentence + 1 : 1

            dbUser.dailyFreezeCounter = 0
            this.messageHelper.sendMessage(interaction.channelId, ':lock: Du e kje bare bonka, du e faktisk dømt te ein dag i fengsel og :lock:')
        }
        DatabaseHelper.updateUser(dbUser)
    }

    private static uwuText(t: string) {
        const firstChoice = ArrayUtils.randomChoiceFromArray(textArrays.asciiEmojies)
        return firstChoice.concat(
            ' ' +
                t
                    .replace(/r/g, 'w')
                    .replace(/l/g, 'w')
                    .concat(' ', ArrayUtils.randomChoiceFromArray(textArrays.asciiEmojies.filter((e) => e !== firstChoice)))
        )
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'wham',
                        command: async (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            rawInteraction.deferReply()
                            const msg = await this.messageHelper.findMessageById('1047851607863349338')
                            if (msg) this.messageHelper.replyToInteraction(rawInteraction, `Whamageddon 2022 status:\n${msg.content}`, { hasBeenDefered: true })
                            else this.messageHelper.replyToInteraction(rawInteraction, `Statusen e ukjent`, { hasBeenDefered: true })
                        },
                    },
                    {
                        commandName: 'mordi',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.mordi(rawInteraction)
                        },
                    },
                    {
                        commandName: 'spell',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.reactWithLetters(rawInteraction)
                        },
                    },
                    {
                        commandName: 'pullrequest',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            const user = rawInteraction.options.get('bruker').user
                            this.messageHelper.replyToInteraction(
                                rawInteraction,
                                `https://github.com/arnekva/Mazarini/pulls ${user ? MentionUtils.mentionUser(user.id) : ''}`
                            )
                        },
                    },
                    {
                        commandName: 'fese',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.harFese(rawInteraction)
                        },
                    },
                    {
                        commandName: 'uwu',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.uWuIfyer(rawInteraction)
                        },
                    },
                    {
                        commandName: 'aktivitet',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.findUserActivity(rawInteraction)
                        },
                    },
                    {
                        commandName: 'eivindpride',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.reactToManyMessages(rawInteraction, DateUtils.isDecember() ? 'eivindclausepride' : 'eivindpride')
                        },
                    },
                    {
                        commandName: 'bonk',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.sendBonk(interaction)
                        },
                    },
                ],
            },
        }
    }
}
