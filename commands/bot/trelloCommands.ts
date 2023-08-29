import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    Client,
    Message,
    ModalBuilder,
    ModalSubmitInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { IInteractionElement } from '../../general/commands'
import { ActionMenuHelper } from '../../helpers/actionMenuHelper'
import { MessageHelper } from '../../helpers/messageHelper'
import { EmbedUtils } from '../../utils/embedUtils'
import { TrelloAPI } from './trelloAPI'
import { INewTrelloCard, ITrelloCard, ITrelloLabel, ITrelloList } from './trelloInterfaces'

export class TrelloCommands extends AbstractCommands {
    static baseUrl = `https://api.trello.com/1/`
    static boardId = '6128df3901a08020e598cd85'
    static backLogId = '6128df3901a08020e598cd86'
    private cards: Map<string, ITrelloCard>
    private labels: Map<string, ITrelloLabel>
    private lists: Map<string, ITrelloList>
    private currentCard: ITrelloCard
    private currentListId: string
    private menu: ActionRowBuilder<StringSelectMenuBuilder>
    private listMenu: ActionRowBuilder<StringSelectMenuBuilder>
    private moveMenu: ActionRowBuilder<StringSelectMenuBuilder>
    private cardsDropdownMessage: Message
    private moveCardMessage: Message

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.currentCard = undefined
        this.menu = undefined
        this.listMenu = undefined
        this.moveMenu = undefined
        this.cardsDropdownMessage = undefined
        this.moveCardMessage = undefined
        this.fetchTrelloData()
    }

    private async fetchTrelloData() {
        this.labels = await TrelloAPI.retrieveTrelloLabels()
        this.lists = await TrelloAPI.retrieveTrelloLists()
    }

    private async fetchTrelloCards() {
        this.cards = await TrelloAPI.retrieveTrelloCards(this.currentListId)
    }

    private async getListsDropdown(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const options: StringSelectMenuOptionBuilder[] = new Array<StringSelectMenuOptionBuilder>()
        Array.from(this.lists.values())
            .slice(0, 24)
            .forEach((list) => {
                const name = list.name.length > 50 ? list.name.substring(0, 47) + '...' : list.name
                options.push(new StringSelectMenuOptionBuilder().setLabel(name).setDescription(' ').setValue(list.id))
            })

        this.listMenu = ActionMenuHelper.createSelectMenu('TrelloLists', 'Velg trello-liste', options)
        let embed = EmbedUtils.createSimpleEmbed(`Hent kortene i en liste`,'Ingen liste valgt')

        this.messageHelper.replyToInteraction(interaction, embed, { ephemeral: false, hasBeenDefered: false }, [this.listMenu])
    }

    private async getCardsDropdown(interaction: StringSelectMenuInteraction<CacheType> | ButtonInteraction<CacheType>) {
        const options: StringSelectMenuOptionBuilder[] = new Array<StringSelectMenuOptionBuilder>()
        Array.from(this.cards.values())
            .slice(0, 24)
            .forEach((card) => {
                const name = card.name.length > 50 ? card.name.substring(0, 47) + '...' : card.name
                options.push(new StringSelectMenuOptionBuilder().setLabel(name).setDescription(' ').setValue(card.id))
            })
        if (options.length > 0) {
            this.menu = ActionMenuHelper.createSelectMenu('TrelloMenu', 'Velg trello-kort', options)
            let embed = EmbedUtils.createSimpleEmbed(`Se informasjon om trello-kort`, 'Ingen kort valgt')
            if (this.cardsDropdownMessage) {
                if (this.currentCard) {
                    const trelloCard = this.cards.get(this.currentCard.id)
                    if (trelloCard) {
                        const name = trelloCard.name.length > 50 ? trelloCard.name.substring(0, 47) + '...' : trelloCard.name
                        this.currentCard = trelloCard
                        const labelString = trelloCard.labels.map((label) => label.name).join(', ')
                        embed = EmbedUtils.createSimpleEmbed(`${name}`, `${trelloCard.desc}\n\nLabels: ${labelString}`)
                    }
                }
                await this.cardsDropdownMessage.edit({
                    embeds: [embed],
                    components: [this.menu, trelloButtons],
                })
            } else {
                this.cardsDropdownMessage = await this.messageHelper.sendMessageWithEmbedAndComponents(interaction.channelId, embed, [this.menu, newTrelloButton])
            }
        } else {
            this.cardsDropdownMessage?.delete()
            this.cardsDropdownMessage = undefined
        }
        
    }

    private async handleListSelected(selectMenu: StringSelectMenuInteraction<CacheType>) {
        this.currentCard = undefined 
        this.currentListId = selectMenu.values[0]
        const list = this.lists.get(this.currentListId)
        await this.fetchTrelloCards()
        await this.getCardsDropdown(selectMenu)
        await selectMenu.update({
            embeds: [EmbedUtils.createSimpleEmbed(`${list.name}`, `${this.cards.size} kort i listen`)],
            components: [this.listMenu],
        })
    }

    private async showCardInfo(selectMenu: StringSelectMenuInteraction<CacheType>) {
        const value = selectMenu.values[0]
        const trelloCard = this.cards.get(value)
        const name = trelloCard.name.length > 50 ? trelloCard.name.substring(0, 47) + '...' : trelloCard.name
        this.currentCard = trelloCard

        const labelString = trelloCard.labels.map((label) => label.name).join(', ')
        await selectMenu.update({
            embeds: [EmbedUtils.createSimpleEmbed(`${name}`, `${trelloCard.desc}\n\nLabels: ${labelString}`)],
            components: [this.menu, trelloButtons],
        })
    }

    private async createModal(interaction: ButtonInteraction<CacheType>, newCard: boolean) {
        const customId = newCard ? 'TrelloModalNew' : 'TrelloModalEdit;' + this.currentCard.id
        const modal = new ModalBuilder().setCustomId(customId).setTitle('TrelloCards')

        const trelloCardTitle = new TextInputBuilder().setCustomId('trelloCardTitle').setLabel('Tittel').setStyle(TextInputStyle.Short)
        if (!newCard) trelloCardTitle.setValue(this.currentCard.name)

        const trelloCardDescription = new TextInputBuilder()
            .setCustomId('trelloCardDescription')
            .setLabel('Beskrivelse')
            .setRequired(false)
            .setStyle(TextInputStyle.Paragraph)
        if (!newCard) trelloCardDescription.setValue(this.currentCard.desc)

        const trelloCardLabels = new TextInputBuilder()
            .setCustomId('trelloCardLabels')
            .setLabel('Labels (komma-separert)')
            .setRequired(false)
            .setStyle(TextInputStyle.Short)
        if (!newCard) trelloCardLabels.setValue(labelsToString(this.currentCard.labels, true))

        const availableLabels = new TextInputBuilder()
            .setCustomId('availableLabels')
            .setLabel('Tilgjengelige labels (ikke rediger)')
            .setRequired(false)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(labelsToString(Array.from(this.labels.values()), false))

        const trelloCardComment = new TextInputBuilder()
            .setCustomId('trelloCardComment')
            .setLabel('Legg til kommentar')
            .setRequired(false)
            .setStyle(TextInputStyle.Paragraph)

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(trelloCardTitle)
        const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(trelloCardDescription)
        const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(trelloCardLabels)
        const fourthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(availableLabels)
        const fifthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(trelloCardComment)

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow)

        await interaction.showModal(modal)
    }

    private async moveCard(interaction: ButtonInteraction<CacheType>) {
        const options: StringSelectMenuOptionBuilder[] = new Array<StringSelectMenuOptionBuilder>()
        Array.from(this.lists.values())
            .slice(0, 24)
            .forEach((list) => {
                options.push(new StringSelectMenuOptionBuilder().setLabel(list.name).setDescription(' ').setValue(list.id))
            })

        this.moveMenu = ActionMenuHelper.createSelectMenu('TrelloMoveMenu;' + this.currentCard.id, 'Flytt til ...', options)
        let embed = EmbedUtils.createSimpleEmbed(`Flytt kort til annen liste`, 'Ingen liste valgt')
        interaction.deferUpdate()
        this.moveCardMessage = await this.messageHelper.sendMessageWithEmbedAndComponents(interaction.channelId, embed, [this.moveMenu, cancelMoveBtnRow])
    }

    private async handleMoveListSelected(selectMenu: StringSelectMenuInteraction<CacheType>) {
        const cardToMoveId = selectMenu.customId.replace('TrelloMoveMenu;', '')
        const cardToMove = this.cards.get(cardToMoveId)
        const value = selectMenu.values[0]
        const newList = this.lists.get(value)
        const oldList = this.lists.get(cardToMove.idList)
        const name = this.currentCard.name.length > 50 ? this.currentCard.name.substring(0, 47) + '...' : this.currentCard.name
        await selectMenu.update({
            embeds: [EmbedUtils.createSimpleEmbed(`Flytter kortet:`, `${name}\n\nFra: ${oldList.name}\n\nTil: ${newList.name}`)],
            components: [this.moveMenu, moveCardButtons(cardToMoveId, value)],
        })
    }

    private async handleMoveTrelloCard(interaction: ButtonInteraction<CacheType>) {
        const ids = interaction.customId.split(';')
        const cardId = ids[1]
        const listId = ids[2]
        let card = this.cards.get(cardId)
        card.idList = listId
        await TrelloAPI.updateTrelloCard(card)
        this.moveCardMessage.delete()
        interaction.deferUpdate()
    }

    private async deleteCard(interaction: ButtonInteraction<CacheType>) {
        const customId = 'TrelloModalDelete;' + this.currentCard.id
        const modal = new ModalBuilder().setCustomId(customId).setTitle('Er du sikker?')

        const trelloCardTitle = new TextInputBuilder()
            .setCustomId('trelloCardTitle')
            .setLabel('Følgende kort vil bli permanent slettet:')
            .setStyle(TextInputStyle.Short)
            .setValue(this.currentCard.name)

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(trelloCardTitle)
        modal.addComponents(firstActionRow)
        await interaction.showModal(modal)
    }

    private async handleDeleteCard(interaction: ModalSubmitInteraction<CacheType>) {
        const cardId = interaction.customId.split(';')[1]
        await TrelloAPI.deleteCard(cardId)
        let embed = EmbedUtils.createSimpleEmbed(`Se informasjon om trello-kort`, 'Ingen kort valgt')
        await this.cardsDropdownMessage.edit({
            embeds: [embed],
            components: [this.menu, trelloButtons],
        })
        interaction.deferUpdate()
    }

    private async handleNewTrelloCard(interaction: ModalSubmitInteraction<CacheType>) {
        const title = interaction.fields.getTextInputValue('trelloCardTitle')
        const desc = interaction.fields.getTextInputValue('trelloCardDescription')
        const labels = interaction.fields.getTextInputValue('trelloCardLabels')
        const idLabels = labels ? this.getLabelIds(labels) : ['']
        const comment = interaction.fields.getTextInputValue('trelloCardComment')

        const newCard: INewTrelloCard = {
            name: title,
            desc: desc,
            idLabels: idLabels,
        }
        const response = await TrelloAPI.addCard(newCard)
        if (comment) {
            TrelloAPI.addCommentToCard(response.id, comment)
        }
        interaction.deferUpdate()
    }

    private async handleTrelloEdits(interaction: ModalSubmitInteraction<CacheType>) {
        const title = interaction.fields.getTextInputValue('trelloCardTitle')
        const desc = interaction.fields.getTextInputValue('trelloCardDescription')
        const labels = interaction.fields.getTextInputValue('trelloCardLabels')
        const comment = interaction.fields.getTextInputValue('trelloCardComment')

        let card = this.cards.get(interaction.customId.split(';')[1])
        card.name = title
        card.desc = desc
        const idLabels = labels ? this.getLabelIds(labels) : ['']
        card.idLabels = idLabels
        const response = await TrelloAPI.updateTrelloCard(card)
        if (comment) {
            TrelloAPI.addCommentToCard(response.id, comment)
        }
        interaction.deferUpdate()
    }

    private getLabelIds(labels: string) {
        const labelArray = labels.split(',')
        let labelIdArray: Array<string> = new Array<string>()
        labelArray.forEach((label) => {
            const labelId = this.labels.get(label.trim().toLowerCase())?.id
            if (labelId) labelIdArray.push(labelId)
        })
        return labelIdArray
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'trello',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            return this.getListsDropdown(rawInteraction)
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'TRELLO_NEW',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.createModal(rawInteraction, true)
                        },
                    },
                    {
                        commandName: 'TRELLO_EDIT',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.createModal(rawInteraction, false)
                        },
                    },
                    {
                        commandName: 'TRELLO_MOVE',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.moveCard(rawInteraction)
                        },
                    },
                    {
                        commandName: 'TRELLO_DELETE',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.deleteCard(rawInteraction)
                        },
                    },
                    {
                        commandName: 'TRELLO_REFRESH',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.fetchTrelloCards().then(() => {
                                this.getCardsDropdown(rawInteraction).then(() => {
                                    rawInteraction.deferUpdate()
                                })
                            })
                        },
                    },
                    {
                        commandName: 'TRELLO_MOVE_CONFIRM',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.handleMoveTrelloCard(rawInteraction)
                        },
                    },
                    {
                        commandName: 'TRELLO_MOVE_CANCEL',
                        command: (rawInteraction: ButtonInteraction<CacheType>) => {
                            this.moveCardMessage.delete()
                            rawInteraction.deferUpdate()
                        },
                    },
                ],
                modalInteractionCommands: [
                    {
                        commandName: 'TrelloModalEdit',
                        command: (rawInteraction: ModalSubmitInteraction<CacheType>) => {
                            this.handleTrelloEdits(rawInteraction)
                        },
                    },
                    {
                        commandName: 'TrelloModalNew',
                        command: (rawInteraction: ModalSubmitInteraction<CacheType>) => {
                            this.handleNewTrelloCard(rawInteraction)
                        },
                    },
                    {
                        commandName: 'TrelloModalDelete',
                        command: (rawInteraction: ModalSubmitInteraction<CacheType>) => {
                            this.handleDeleteCard(rawInteraction)
                        },
                    },
                ],
                selectMenuInteractionCommands: [
                    {
                        commandName: 'TrelloLists',
                        command: (rawInteraction: StringSelectMenuInteraction<CacheType>) => {
                            this.handleListSelected(rawInteraction)
                        },
                    },
                    {
                        commandName: 'TrelloMenu',
                        command: (rawInteraction: StringSelectMenuInteraction<CacheType>) => {
                            this.showCardInfo(rawInteraction)
                        },
                    },
                    {
                        commandName: 'TrelloMoveMenu',
                        command: (rawInteraction: StringSelectMenuInteraction<CacheType>) => {
                            this.handleMoveListSelected(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}

const labelsToString = (labels: Array<ITrelloLabel>, comma: boolean) => {
    let s = ''
    labels.forEach((label) => {
        s += `${label.name}${comma ? ',' : '\n'}`
    })
    return comma ? s.substring(0, s.length - 1) : s
}

const newTrelloButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: 'TRELLO_NEW',
        style: ButtonStyle.Success,
        label: `Nytt kort`,
        disabled: false,
        type: 2,
    })
)

const trelloButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: 'TRELLO_NEW',
        style: ButtonStyle.Success,
        label: `Nytt kort`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: 'TRELLO_EDIT',
        style: ButtonStyle.Primary,
        label: `Rediger`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: 'TRELLO_MOVE',
        style: ButtonStyle.Primary,
        label: `Flytt`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: 'TRELLO_DELETE',
        style: ButtonStyle.Danger,
        label: `Slett`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: 'TRELLO_REFRESH',
        style: ButtonStyle.Secondary,
        label: `↻`,
        disabled: false,
        type: 2,
    })
)

const cancelMoveBtn = new ButtonBuilder({
    custom_id: 'TRELLO_MOVE_CANCEL',
    style: ButtonStyle.Secondary,
    label: `Avbryt`,
    disabled: false,
    type: 2,
})

const cancelMoveBtnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelMoveBtn)

const moveCardButtons = (cardId: string, newListId: string) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            custom_id: 'TRELLO_MOVE_CONFIRM;' + cardId + ';' + newListId,
            style: ButtonStyle.Success,
            label: `Bekreft`,
            disabled: false,
            type: 2,
        }),
        cancelMoveBtn
    )
}
