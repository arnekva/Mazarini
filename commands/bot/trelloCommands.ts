import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { trelloApiKey, trelloToken } from '../../client-env'
import { IInteractionElement } from '../../general/commands'
import { MessageHelper } from '../../helpers/messageHelper'
const fetch = require('node-fetch')
export class TrelloCommands extends AbstractCommands {
    static baseUrl = `https://api.trello.com/1/`
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private async addCard(interaction: ChatInputCommandInteraction<CacheType>) {
        interaction.deferReply()
        const header = interaction.options.get('overskrift')?.value as string
        const body = interaction.options.get('tekst')?.value as string
        const boardId = '6128df3901a08020e598cd85'
        const backLogId = '6128df3901a08020e598cd86'
        const url =
            TrelloCommands.baseUrl +
            `cards?idList=${backLogId}&key=${trelloApiKey}&token=${trelloToken}&` +
            new URLSearchParams({
                name: header,
                desc: body,
            })
        const form = new FormData()
        form.append('name', header)
        form.append('desc', body)
        const card = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
            },
        })
        console.log(card)
        this.messageHelper.replyToInteraction(interaction, 'Issue er lagt til i backlog', false, true)
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'issue',
                command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                    this.addCard(rawInteraction)
                },
            },
        ]
    }
}
