import { CacheType, Client, Interaction, InteractionType, ModalSubmitInteraction } from 'discord.js'
import { Admin } from '../admin/admin'
import { MessageHelper } from '../helpers/messageHelper'
import { MentionUtils } from '../utils/mentionUtils'

export class ModalHandler {
    private client: Client
    private messageHelper: MessageHelper

    constructor(client: Client, messageHelper: MessageHelper) {
        this.client = client
        this.messageHelper = messageHelper
    }

    handleIncomingModalInteraction(rawInteraction: Interaction<CacheType>): boolean {
        if (rawInteraction.type === InteractionType.ModalSubmit) {
            //Is Modal
            const localIntr = rawInteraction as ModalSubmitInteraction
            const interactionID = localIntr.customId
            if (interactionID === Admin.adminSendModalID) {
                this.handleAdminSendModalDialog(localIntr)
                return true
            }
        }
        return false
    }

    private handleAdminSendModalDialog(modalInteraction: ModalSubmitInteraction) {
        const chatID = modalInteraction.fields.getTextInputValue('channelID')
        const text = modalInteraction.fields.getTextInputValue('messageInput')

        this.messageHelper.sendMessage(chatID, text)
        this.messageHelper.replyToInteraction(modalInteraction, `Meldingen <*${text}*> ble sent til kanalen med ID <*${chatID}*>`, true)
        this.messageHelper.sendLogMessage(
            `${modalInteraction.user.username} sendte en melding som botten til kanalen ${MentionUtils.mentionChannel(chatID)} med innholdet '*${text}*'`
        )
    }
}
