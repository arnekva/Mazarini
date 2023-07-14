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
    static GUESS = this.REDBLACK + 'Guess_'
    static GUESS_RED_BLACK = this.GUESS + 'RB_'
    static GUESS_UP_DOWN = this.GUESS + 'UD_'
    static GUESS_IN_OUT = this.GUESS + 'IO_'
    static GUESS_SUIT = this.GUESS + 'S_'
    static PLACE = this.REDBLACK + 'Place_'
    static NEXT_CARD = this.REDBLACK + 'NextCard_'
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
                this.redBlack(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.PLACE)) {
                this.placeCard(interaction)
            // } else if (interaction.customId.startsWith(RedBlackButtonHandler.TEST)) {
            //     this.testRedBlack(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.NEXT_CARD)) {
                this.nextCard(interaction)
            } 
        }
        return false
    }

    private default(interaction: ButtonInteraction<CacheType>) {
        //this.redBlackCommands.drawCard(interaction)
    }

    private async redBlack(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.redBlackController(interaction)
    }

    private async placeCard(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.placeGtCard(interaction)
    }

    // private async testRedBlack(interaction: ButtonInteraction<CacheType>) {
    //     await this.redBlackCommands.generateGiveTakeTable(interaction)
    //     this.redBlackCommands.printGiveTakeTable(interaction)
    // }

    private async nextCard(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.nextGtCard(interaction)
    }

    private verifyParticipatingUser(interaction: ButtonInteraction<CacheType>) {
        return this.redBlackCommands.checkUserIsActivePlayer(interaction.user.username)
    }
}
