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
    static GUESS_RB = this.GUESS + 'RB_'
    static GUESS_UD = this.GUESS + 'UD_'
    static GUESS_IO = this.GUESS + 'IO_'
    static GUESS_S = this.GUESS + 'S_'
    static PLACE = this.REDBLACK + 'Place_'
    static MOVE = this.REDBLACK + 'Move_'
    static TEST = this.REDBLACK + 'Test_'
    static NEXT_PHASE = this.REDBLACK + 'NextPhase_'
    static MY_CARDS = this.REDBLACK + 'MyCards_'

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
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.TEST)) {
                this.testRedBlack(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.NEXT_CARD)) {
                this.nextCard(interaction)
            } 
        }
        return false
    }

    private default(interaction: ButtonInteraction<CacheType>) {
        //this.redBlackCommands.drawCard(interaction)
    }

    private async testRedBlack(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.generateGiveTakeTable(interaction)
        this.redBlackCommands.printGiveTakeTable(interaction)
    }

    private async nextCard(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.revealNextGTCard(interaction)
    }

    private verifyParticipatingUser(interaction: ButtonInteraction<CacheType>) {
        return this.redBlackCommands.checkUserIsActivePlayer(interaction.user.username)
    }
}
