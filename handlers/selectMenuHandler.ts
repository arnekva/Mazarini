import { CacheType, Client, Interaction, SelectMenuInteraction } from 'discord.js'
import { TrelloCommands } from '../commands/bot/trelloCommands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { EmbedUtils } from '../utils/embedUtils'

export class SelectMenuHandler {
    private client: Client
    private messageHelper: MessageHelper
    private trello: TrelloCommands

    static userInfoId = 'brukerinfoMenu'
    static trelloMenuId = 'trelloMeny'
    constructor(client: Client, messageHelper: MessageHelper, trello: TrelloCommands) {
        this.client = client
        this.messageHelper = messageHelper
        this.trello = trello
    }

    handleIncomingSelectMenu(rawInteraction: Interaction<CacheType>) {
        if (rawInteraction.isStringSelectMenu()) {
            const localIntr = rawInteraction as SelectMenuInteraction
            if (localIntr.customId === SelectMenuHandler.trelloMenuId) {
                this.handleTrelloCard(localIntr)
                return true
            } else if (rawInteraction.message.interaction.user === rawInteraction.user) {
                this.handleUserInfoViewingMenu(localIntr)
                return true
            } else {
                return !!this.messageHelper.replyToInteraction(
                    rawInteraction,
                    `Du kan bare sjekka dine egne ting. Bruke '/brukerinfo' for å se dine egne verdier`,
                    true
                )
            }
        }
        return false
    }

    private async handleUserInfoViewingMenu(selectMenu: SelectMenuInteraction<CacheType>) {
        if (selectMenu.customId === SelectMenuHandler.userInfoId) {
            const value = selectMenu.values[0]
            let userData = DatabaseHelper.getUser(selectMenu.user.id)[value]

            if (typeof userData === 'object') {
                userData = Object.entries(userData).map((entry, val) => {
                    return `\n${entry[0]} - ${entry[1]}`
                })
            }
            userData.toString()
            await selectMenu.update({
                embeds: [EmbedUtils.createSimpleEmbed(`Se brukerinfo for ${selectMenu.user.username}`, `Verdien for ${value} er ${userData}`)],
            })
        }
    }

    private async handleTrelloCard(selectMenu: SelectMenuInteraction<CacheType>) {
        this.trello.showCardInfo(selectMenu)
    }
}
