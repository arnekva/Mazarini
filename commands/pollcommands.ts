import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../general/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { ArrayUtils } from '../utils/arrayUtils'
import { EmbedUtils } from '../utils/embedUtils'
import { UserUtils } from '../utils/userUtils'

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
    multipleAnswers: boolean
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
            const multipleAnswers = interaction.options.get('flersvar')?.value as boolean
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
                multipleAnswers: !!multipleAnswers,
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
        //Has correct poll
        if (poll) {
            const multipleAnswers = poll.multipleAnswers
            const currOption = poll.options.find((o) => o.id === votesFor)
            const hasVotedForOption = currOption.votes.find((v) => v?.userId === userId)
            //If user has already voted for this option, remove the vote
            if (hasVotedForOption) {
                ArrayUtils.removeItemOnce(currOption.votes, hasVotedForOption)

                this.messageHelper.replyToInteraction(interaction, `Slettet stemmen din`, { ephemeral: true })
            } else {
                //If multiple answers is not allowed, remove the other vote
                const hasVotedForAnything = poll.options.find((o) => !!o.votes.find((c) => c.userId === userId))
                const cantHaveMoreThanOneVote = !multipleAnswers && hasVotedForAnything
                if (cantHaveMoreThanOneVote) {
                    const voteToRemove = hasVotedForAnything.votes.find((c) => c.userId === userId)
                    ArrayUtils.removeItemOnce(hasVotedForAnything.votes, voteToRemove)
                }
                //Add vote to poll
                const optionToVote = poll.options.findIndex((o) => o.id === votesFor)
                poll.options[optionToVote].votes.push({
                    userId: userId,
                })
                this.messageHelper.replyToInteraction(interaction, `La til stemmen din ${cantHaveMoreThanOneVote ? ' og slettet din andre stemme' : ''}`, {
                    ephemeral: true,
                })
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
            let allVotees: string[] = []
            poll.options.forEach((option) => {
                option.votes.forEach((vote) => {
                    const user = UserUtils.findUserById(vote.userId, interaction)
                    if (user) allVotees.push(user.username)
                })
            })
            allVotees = ArrayUtils.removeAllDuplicates(allVotees)
            let printNames = ''
            if (allVotees.length === 0) printNames = 'ingen'
            else if (allVotees.length === 1) printNames = allVotees[0]
            else printNames = allVotees.slice(0, -1).join(',') + ' og ' + allVotees.slice(-1)
            embed.setFooter({ text: `Stemt: ${printNames}` })
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
