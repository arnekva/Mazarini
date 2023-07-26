import { ButtonInteraction, CacheType, Client, Interaction } from 'discord.js'

import { MessageHelper } from '../../../helpers/messageHelper'
import { RedBlackCommands } from './redBlackCommands'

export class RedBlackButtonHandler {
    private client: Client
    private messageHelper: MessageHelper
    private redBlackCommands: RedBlackCommands
    
    static REDBLACK = 'RedBlack_'
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
    static BUSRIDE = this.REDBLACK + 'Busride_'
    static CANADIAN_GUESS = this.BUSRIDE + 'Canadian_'
    static TRY_AGAIN = this.BUSRIDE + 'TryAgain_'
    static REVEAL_LOSER = this.REDBLACK + 'RevealLoser_'
    static START_BUSRIDE = this.BUSRIDE + 'Start_'
    static TIE_BREAK = this.REDBLACK + 'TieBreak_'

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
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.MOVE)) {
                this.moveMessages(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.REVEAL_LOSER)) {
                this.revealLoser(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.TIE_BREAK)) {
                this.tieBreak(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.START_BUSRIDE)) {
                this.startBusRide(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.CANADIAN_GUESS)) {
                this.busRideGuess(interaction)
            } else if (interaction.customId.startsWith(RedBlackButtonHandler.TRY_AGAIN)) {
                this.busRideTryAgain(interaction)
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
        if (interaction.user.id === '221739293889003520') interaction.deferUpdate()
        else await this.redBlackCommands.nextGtCard(interaction)
    }

    private async moveMessages(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.resendMessages(interaction)
        interaction.deferUpdate()
    }

    private async revealLoser(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.revealLoser(interaction)
    }

    private async tieBreak(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.showGiveTakeSummary(interaction)
    }

    private async startBusRide(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.setupBusride(interaction)
    }
    
    private async busRideGuess(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.busrideGuess(interaction)
    }

    private async busRideTryAgain(interaction: ButtonInteraction<CacheType>) {
        await this.redBlackCommands.busrideReset(interaction)
    }
}
