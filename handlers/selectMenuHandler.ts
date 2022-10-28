import { CacheType, Client, Interaction, SelectMenuInteraction } from 'discord.js'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { EmbedUtils } from '../utils/embedUtils'

export class SelectMenuHandler {
    private client: Client
    private messageHelper: MessageHelper

    static userInfoId = 'brukerinfoMenu'
    constructor(client: Client, messageHelper: MessageHelper) {
        this.client = client
        this.messageHelper = messageHelper
    }

    handleIncomingSelectMenu(rawInteraction: Interaction<CacheType>) {
        if (rawInteraction.isSelectMenu()) {
            if (rawInteraction.message.interaction.user === rawInteraction.user) {
                const localIntr = rawInteraction as SelectMenuInteraction

                this.handleUserInfoViewingMenu(localIntr)
                return true
            } else {
                this.messageHelper.replyToInteraction(rawInteraction, `Du kan bare sjekka dine egne ting. Bruke '/brukerinfo' for å se dine egne verdier`, true)
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
}
