import { APIEmbedField, CacheType, ChatInputCommandInteraction, TextChannel, User } from 'discord.js'
import moment, { Moment } from 'moment'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'

import { EmojiHelper } from '../helpers/emojiHelper'
import { IInteractionElement } from '../interfaces/interactionInterface'
import { ArrayUtils } from '../utils/arrayUtils'
import { DateUtils } from '../utils/dateUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { ChannelIds, MentionUtils } from '../utils/mentionUtils'
import { MessageUtils } from '../utils/messageUtils'
import { MiscUtils } from '../utils/miscUtils'
import { RandomUtils } from '../utils/randomUtils'
import { textArrays } from '../utils/textArrays'
import { UserUtils } from '../utils/userUtils'

export class JokeCommands extends AbstractCommands {
    private prevGifIndex: number

    constructor(client: MazariniClient) {
        super(client)
    }

    private async mordi(interaction: ChatInputCommandInteraction<CacheType>) {
        const emoji = await EmojiHelper.getEmoji('eyebrows', interaction)
        this.messageHelper.replyToInteraction(interaction, Math.random() > 0.3 ? `E nais ${emoji.id}` : `E skamnais ${emoji.id}`)
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

    private reactToManyMessages(interaction: ChatInputCommandInteraction<CacheType>, emojiName: string) {
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
                    .catch(() => {})
            }
        } catch (error) {
            this.messageHelper.sendLogMessage(`Noe gikk galt i reactToManyMessages`)
        }
    }

    private async reactWithLetters(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply({ ephemeral: true })
        const text = interaction.options.get('melding')?.value as string
        const msgId = interaction.options.get('melding-id')?.value as string

        const letterTab: string[] = text.split('')

        const messageToReactTo = await MessageUtils.findMessageById(msgId, this.client)
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
                messageToReactTo.react(emoji).catch(() => this.messageHelper.sendLogMessage(`Fant ikke emoji for bokstaven '${letter}'.`))
            } catch (error) {
                this.messageHelper.sendLogMessage(`Fant ikke emoji for bokstaven '${letter}'.`)
            }
        })
        interaction.editReply(':white_check_mark:')
    }

    private async uWuIfyer(interaction: ChatInputCommandInteraction<CacheType>) {
        const id = interaction.options.get('melding-id')?.value as string
        this.messageHelper.replyToInteraction(interaction, 'Prøver å uwu-ifye meldingen hvis jeg finner den', { ephemeral: true })
        if (id && !isNaN(Number(id))) {
            const msgToUwU = await MessageUtils.findMessageById(id, this.client)
            if (msgToUwU) {
                const uwuIfiedText = JokeCommands.uwuText(msgToUwU.content)
                this.messageHelper.sendMessage(interaction?.channelId, { text: uwuIfiedText })
            }
        }
    }

    private async harFese(interaction: ChatInputCommandInteraction<CacheType>) {
        const channel = interaction?.channel as TextChannel
        const role = this.getRoleBasedOnChannel(interaction?.channelId)

        const memberList = role ? channel.members.filter((m) => m.roles.cache.get(role) !== undefined) : channel.members
        let user: User
        const thread = interaction.channel
        //Threads doesn't hold members the same way as normal channels, so we need to fetch them
        if (thread.isThread()) {
            user = (await thread.members.fetch()).random().user
        } else {
            user = memberList.random().user
        }
        const authorName = interaction.user.username
        const randomName = user.username

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

        const dbUser = await this.client.database.getUser(user.id)
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

            dbUser.daily.dailyFreezeCounter = 0
            this.messageHelper.sendMessage(interaction.channelId, { text: ':lock: Du e kje bare bonka, du e faktisk dømt te ein dag i fengsel og :lock:' })
        }
        this.client.database.updateUser(dbUser)
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

    private async whamageddon(interaction: ChatInputCommandInteraction<CacheType>) {
        const isRegisterLoss = interaction.options.getSubcommand() === 'tapt'
        const endDate = `${new Date().getFullYear()}-12-24 16:00`
        const isValidTimeFrame = DateUtils.currentDateIsBetween(
            moment(`01-12-${new Date().getFullYear()} 16:00`, 'DD-MM-YYYY HH:mm'),
            moment(endDate, 'DD-MM-YYYY HH:mm')
        )

        const calcSlurks = (d1: Moment) => {
            const slurks = DateUtils.getDaysBetweenDates(d1, moment(endDate, 'YYYY-MM-DD 12:00')) + 1

            const shots = DateUtils.getWeeksBetweenDates(d1, moment(endDate, 'YYYY-MM-DD 12:00'))
            return {
                slurker: slurks,
                shots: shots,
            }
        }
        if (isRegisterLoss) {
            const user = await this.client.database.getUser(interaction.user.id)
            if (user.whamageddonLoss) {
                this.messageHelper.replyToInteraction(interaction, `Du har allerede registrert tapet ditt`, { ephemeral: true })
            } else if (isValidTimeFrame) {
                user.whamageddonLoss = moment().toISOString()
                this.client.database.updateUser(user)
                const drinkData = calcSlurks(moment(user.whamageddonLoss))
                this.messageHelper.replyToInteraction(
                    interaction,
                    `Kondolere. Ditt tap e registrert, og du må ta ${drinkData.slurker} slurker og ${
                        drinkData.shots
                    } shots. Eg melde dette te ${MentionUtils.mentionChannel(ChannelIds.GENERAL)} for deg`,
                    {
                        ephemeral: true,
                    }
                )
                const emb = EmbedUtils.createSimpleEmbed(
                    `#Whamageddon`,
                    `${MentionUtils.mentionUser(interaction.user.id)} gjekk på ein saftige smell.  `
                ).setFooter({
                    text: `${drinkData.slurker} slurker og ${drinkData.shots} shots.`,
                })
                this.messageHelper.sendMessage(ChannelIds.GENERAL, { embed: emb })
            } else {
                this.messageHelper.replyToInteraction(
                    interaction,
                    `Whamageddon starte ikkje før 01 Desember 08:00. Fram te det kan du hørra på an så mye du vil`
                )
            }
        } else {
            const users = await this.client.database.getAllUsers()
            const usersInWhamageddon = users.filter((u) => !!u.whamageddonLoss)
            if (usersInWhamageddon.length) {
                const embd = EmbedUtils.createSimpleEmbed(`Whamageddon ${new Date().getFullYear()}`, `Status`)
                usersInWhamageddon.forEach((user) => {
                    //Since moment takes time into account when calculating diff, set time to be 12:00 so it's always before the end time, otherwise it can return a lower
                    //amount than expected
                    const drinkData = calcSlurks(moment(user.whamageddonLoss))
                    embd.addFields([
                        {
                            name: UserUtils.findUserById(user.id, interaction).username ?? 'Ukjent',
                            value:
                                DateUtils.formatDate(moment(user.whamageddonLoss).toDate(), true) + ` (${drinkData.slurker} slurker, ${drinkData.shots} shots)`,
                        },
                    ])
                })
                this.messageHelper.replyToInteraction(interaction, embd)
            } else {
                this.messageHelper.replyToInteraction(
                    interaction,
                    isValidTimeFrame ? `Ingen har tapt Whamageddon ennå` : `Whamageddon starte 01. Desember 08:00`
                )
            }
        }
    }

    private sendPointerBrothers(interaction: ChatInputCommandInteraction<CacheType>) {
        const index = RandomUtils.getRandomIntegerExcludingNumber(textArrays.pointerBrothersUrls.length, this.prevGifIndex)
        this.prevGifIndex = index
        const randomGif = textArrays.pointerBrothersUrls[index]
        this.messageHelper.replyToInteraction(interaction, randomGif)
        //this.messageHelper.sendMessage(interaction.channelId, { text: randomGif })
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'whamageddon',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.whamageddon(rawInteraction)
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
                    {
                        commandName: 'pointerbrothers',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            this.sendPointerBrothers(interaction)
                        },
                    },
                ],
            },
        }
    }
}
