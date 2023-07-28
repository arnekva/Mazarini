import { CacheType, ChatInputCommandInteraction, Client, ModalBuilder, SelectMenuInteraction, StringSelectMenuOptionBuilder } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { trelloApiKey, trelloToken } from '../../client-env'
import { IInteractionElement } from '../../general/commands'
import { SelectMenuHandler } from '../../handlers/selectMenuHandler'
import { ActionMenuHelper } from '../../helpers/actionMenuHelper'
import { MessageHelper } from '../../helpers/messageHelper'
import { EmbedUtils } from '../../utils/embedUtils'
import { ITrelloCard } from './trelloInterfaces'
const fetch = require('node-fetch')
export class TrelloCommands extends AbstractCommands {

    static baseUrl = `https://api.trello.com/1/`
    static boardId = '6128df3901a08020e598cd85'
    static backLogId = '6128df3901a08020e598cd86'
    private cards: Map<string, ITrelloCard>

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.cards = new Map<string, ITrelloCard>()
    }

    private async addCard(interaction: ChatInputCommandInteraction<CacheType>) {
        interaction.deferReply()
        const header = interaction.options.get('overskrift')?.value as string
        const body = interaction.options.get('tekst')?.value as string
        
        const url =
            TrelloCommands.baseUrl +
            `cards?idList=${TrelloCommands.backLogId}&key=${trelloApiKey}&token=${trelloToken}&` +
            new URLSearchParams({
                name: header,
                desc: body,
            })

        const card = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
            },
        })
        console.log(card)
        this.messageHelper.replyToInteraction(interaction, 'Issue er lagt til i backlog', false, true)
    }

    public async retrieveTrelloCards() {        
        const url = TrelloCommands.baseUrl +
            `lists/${TrelloCommands.backLogId}/cards?key=${trelloApiKey}&token=${trelloToken}`

        const response: Array<ITrelloCard> = await (await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        })).json()
        response.forEach((card) => {            
            this.cards.set(card.id, card)            
        })        
    }

    public async getTrelloDropdown(interaction: ChatInputCommandInteraction<CacheType>) {
        await this.retrieveTrelloCards()        
        const options: StringSelectMenuOptionBuilder[] = new Array<StringSelectMenuOptionBuilder>()
        Array.from(this.cards.values()).slice(0, 24).forEach((card) => {   
            const name = card.name.length > 50 ? card.name.substring(0,47) + '...' : card.name
            options.push(new StringSelectMenuOptionBuilder()
            .setLabel(name)
            .setDescription(' ')
            .setValue(card.id),
        )})        

        const menu = ActionMenuHelper.creatSelectMenu(SelectMenuHandler.trelloMenuId, 'Velg trello-kort', options)
        const embed = EmbedUtils.createSimpleEmbed(`Se informasjon om trello-kort`, 'Ingen kort valgt')
        this.messageHelper.replyToInteraction(interaction, embed, false, false, menu)
    }

    public async showCardInfo(selectMenu: SelectMenuInteraction<CacheType>) {
        const value = selectMenu.values[0]
        const trelloCard = this.cards.get(value)
        const name = trelloCard.name.length > 50 ? trelloCard.name.substring(0,47) + '...' : trelloCard.name
        
        const labelString = trelloCard.labels.map((label) => label.name).join(", ")
        await selectMenu.update({
            embeds: [EmbedUtils.createSimpleEmbed(`${name}`, `${trelloCard.desc}\n\nLabels: ${labelString}`)],
        })
    }

    public async createModal(interaction: ChatInputCommandInteraction<CacheType>) {
        const modal = new ModalBuilder()
			.setCustomId('trelloModal')
			.setTitle('TrelloCards');
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'issue',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.addCard(rawInteraction)
                },
            },
            {
                commandName: 'trello',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.getTrelloDropdown(rawInteraction)
                },
            },
        ]
    }
}
