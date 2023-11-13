import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { EmbedUtils } from '../utils/embedUtils'

interface IPollVote {
    userId: string
}
interface IPollOption {
    name: string
    id: number
    votes: IPollVote[]
}
export interface IPoll {
    id: string
    desc: string
    options: IPollOption[]
    messageId: string
}
export class PollCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
    }

    private currentPolls: IPoll[] = []

    private async createPoll(interaction: ChatInputCommandInteraction<CacheType>) {
        const currPollId = interaction.id
        const isCreate = interaction.options.getSubcommand() === 'lag'
        if (isCreate) {
            const description = interaction.options.get('beskrivelse')?.value as string
            const options1 = interaction.options.get('1')?.value as string
            const options2 = interaction.options.get('2')?.value as string
            const options3 = interaction.options.get('3')?.value as string
            const options4 = interaction.options.get('4')?.value as string
            const options5 = interaction.options.get('5')?.value as string

            const allOptions = [options1, options2, options3, options4, options5].filter((o) => !!o)
            const embed = EmbedUtils.createSimpleEmbed(`Poll`, description || 'Enkel poll')
            const row = new ActionRowBuilder<ButtonBuilder>()
            const opt: IPollOption[] = []
            allOptions.forEach((o) => [])
            this.buildVoteButtons(allOptions, row, opt, currPollId)

            this.messageHelper.replyToInteraction(interaction, `Startet en poll`, { ephemeral: true })
            const msg = await this.messageHelper.sendMessage(interaction.channelId, { embed: embed, components: [row] })

            const stPolls = this.pollsFromStorage
            stPolls.push({
                id: currPollId,
                options: opt,
                messageId: msg.id,
                desc: description,
            })
            DatabaseHelper.updateStorage({
                polls: stPolls,
            })
        } else {
            this.showPoll(interaction)
        }
    }

    private buildVoteButtons(allOptions: string[], row: ActionRowBuilder<ButtonBuilder>, opt: IPollOption[], currPollId: string) {
        allOptions.forEach((option, idx) => {
            row.addComponents([
                new ButtonBuilder({
                    custom_id: `POLL_VOTE;${idx};${currPollId}`,
                    style: ButtonStyle.Primary,
                    label: `${option}`,
                    disabled: false,
                    type: 2,
                }),
            ])
            opt.push({
                id: idx,
                name: option,
                votes: [],
            })
        })
    }

    get pollsFromStorage() {
        const polls = DatabaseHelper.getStorage().polls

        if (!polls) DatabaseHelper.updateStorage({ polls: [] })
        return polls
    }

    private async showPoll(interaction: ChatInputCommandInteraction<CacheType>) {
        const id = interaction.options.get('pollnavn')?.value as string
        const polls = this.pollsFromStorage
        const poll = polls.find((p) => p.id === id)
        if (poll) {
            this.messageHelper.replyToInteraction(interaction, `Vise pollen under`, { ephemeral: true })
            const embed = EmbedUtils.createSimpleEmbed(`Poll`, poll.desc || 'Enkel poll')
            poll.options.forEach((option) => {
                embed.addFields([
                    {
                        name: option.name,
                        value: option.votes.length + ' stemmer',
                    },
                ])
            })
            const row = new ActionRowBuilder<ButtonBuilder>()
            const opt: IPollOption[] = []
            this.buildVoteButtons(
                poll.options.map((o) => o.name),
                row,
                opt,
                id
            )
            const msg = await this.messageHelper.sendMessage(interaction.channelId, { embed: embed, components: [row] })
            poll.messageId = msg.id
            DatabaseHelper.updateStorage({
                polls: polls,
            })
        } else {
            this.messageHelper.replyToInteraction(interaction, `Fant ikke pollen`, { ephemeral: true })
        }
    }

    private async updatePoll(interaction: ButtonInteraction<CacheType>) {
        const ids = interaction.customId.split(';')
        const votesFor = Number(ids[1])
        const pollId = ids[2]
        const userId = interaction.user.id

        const polls = this.pollsFromStorage
        const poll = polls.find((p) => p.id === pollId)
        if (poll) {
            //Has correct poll

            const currOption = poll.options.find((o) => o.id === votesFor)
            const hasVotedForOption = currOption.votes.find((v) => v?.userId === userId)
            if (hasVotedForOption) {
                const voteIndex = hasVotedForOption
                ArrayUtils.removeItemOnce(currOption.votes, hasVotedForOption)
                this.messageHelper.replyToInteraction(interaction, `Slettet stemmen din`, { ephemeral: true })
            } else {
                const optionToVote = poll.options.findIndex((o) => o.id === votesFor)
                poll.options[optionToVote].votes.push({
                    userId: userId,
                })
                this.messageHelper.replyToInteraction(interaction, `La til stemmen din`, { ephemeral: true })
            }

            const embed = EmbedUtils.createSimpleEmbed(`Poll`, poll.desc || 'Enkel poll')
            poll.options.forEach((option) => {
                embed.addFields([
                    {
                        name: option.name,
                        value: option.votes.length + ' stemmer',
                    },
                ])
            })

            const msg = interaction.channel.messages.cache.find((m) => m.id === poll.messageId)
            if (msg?.id && msg.editable) {
                msg.edit({ embeds: [embed] })
            } else {
                const row = new ActionRowBuilder<ButtonBuilder>()
                const opt: IPollOption[] = []
                this.buildVoteButtons(
                    poll.options.map((o) => o.name),
                    row,
                    opt,
                    pollId
                )
                const sentMsg = await this.messageHelper.sendMessage(interaction.channelId, { embed: embed, components: [row] })
                // this.messageHelper.sendMessageWithComponents(interaction.channelId, [row])
                poll.messageId = sentMsg.id
            }
            DatabaseHelper.updateStorage({
                polls: polls,
            })
        }
    }

    private filterPolls(interaction: AutocompleteInteraction<CacheType>) {
        const optionList: any = interaction.options
        const input = optionList.getFocused().toLowerCase()
        const polls = this.pollsFromStorage.filter((p) => p.desc.includes(input)).map((poll) => ({ name: `${poll.desc}`, value: poll.id }))
        interaction.respond(polls)
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'poll',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.createPoll(rawInteraction)
                        },
                        autoCompleteCallback: (rawInteraction: AutocompleteInteraction<CacheType>) => {
                            this.filterPolls(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'POLL_VOTE',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.updatePoll(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
