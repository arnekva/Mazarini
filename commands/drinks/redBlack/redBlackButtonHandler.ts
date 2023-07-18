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
            if (interaction.customId.startsWith(RedBlackButtonHandler.JOIN)) {
                this.join(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.START)) {
                this.start(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.GUESS)) {
                this.guess(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.NEXT_PHASE)) {
                this.nextPhase(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.PLACE)) {
                this.placeCard(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.NEXT_CARD)) {
                this.nextCard(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.TEST)) {
                this.testRedBlack(interaction)
            } 
        }
        return false
    }

    private default(interaction: ButtonInteraction<CacheType>) {
        //this.redBlackCommands.drawCard(interaction)
    }

    private async join(interaction:ButtonInteraction<CacheType>) {
        await this.redBlackCommands.joinGame(interaction)
    }

    private async start(interaction:ButtonInteraction<CacheType>) {
        await this.redBlackCommands.startGame(interaction)
    }

    private async guess(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.guess(interaction)
    }

    private async nextPhase(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.phaseController(interaction)
    }

    private async placeCard(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.placeGtCard(interaction)
    }

    private async testRedBlack(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.setupRedBlack(interaction)
    }

    private async nextCard(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.nextGtCard(interaction)
    }

    // private verifyParticipatingUser(interaction: ButtonInteraction<CacheType>) {
    //     return this.redBlackCommands.checkUserIsActivePlayer(interaction.user.username)
    // }
}
