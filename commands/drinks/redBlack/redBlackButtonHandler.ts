import { ButtonInteraction, CacheType, Client, Interaction } from 'discord.js'

import { MessageHelper } from '../../../helpers/messageHelper'
import { RedBlackCommands } from './redBlackCommands'

export class RedBlackButtonHandler {
    private client: Client
    private messageHelper: MessageHelper
    private redBlackCommands: RedBlackCommands
    
    static REDBLACK = 'RedBlack'
    static JOIN = this.REDBLACK + 'Join_'
    static START = this.REDBLACK + 'Start_'
    static NEXT_CARD = this.REDBLACK + 'NextCard_'
    static GUESS = this.REDBLACK + 'Guess_'
    static PLACE = this.REDBLACK + 'Place_'
    static MOVE = this.REDBLACK + 'Move_'

    constructor(client: Client, messageHelper: MessageHelper, redBlackCommands: RedBlackCommands) {
        this.client = client
        this.messageHelper = messageHelper
        this.redBlackCommands = redBlackCommands
    }

    handleIncomingButtonInteraction(interaction: Interaction<CacheType>) {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith(RedBlackButtonHandler.GUESS)) {
                this.default(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.PLACE)) {
                this.default(interaction)
            } 
        }
        return false
    }

    private default(interaction: ButtonInteraction<CacheType>) {
        this.redBlackCommands.drawCard(interaction)
    }

    private verifyParticipatingUser(interaction: ButtonInteraction<CacheType>) {
        return this.redBlackCommands.checkUserIsActivePlayer(interaction.user.username)
    }
}
