import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { GameStateHandler, GamePlayer } from '../../handlers/gameStateHandler'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { CardCommands, ICardObject } from './cardCommands'
import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
interface BlackjackPlayer extends GamePlayer {
    id: string
    playerName: string
    hand: ICardObject[]
    stake?: number
}

export class Blackjack extends AbstractCommands {
    private gameStateHandler: GameStateHandler<BlackjackPlayer>
    private deck: CardCommands
    private dealer: BlackjackPlayer

    constructor(client: MazariniClient) {
        super(client)
        this.gameStateHandler = new GameStateHandler<BlackjackPlayer>()
        this.deck = new CardCommands(client, 6)
    }

    private async buyIn(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        let userMoney = user.chips
        const stake = SlashCommandHelper.getCleanNumberValue(interaction.options.get('satsing')?.value)
        if (Number(stake) > Number(userMoney) || !userMoney || userMoney < 0) {
            this.messageHelper.replyToInteraction(interaction, 'Du har ikke nok penger til å gamble så mye. Ta å spin fidget spinneren litt for någe cash', {ephemeral: true})
        } else if (this.gameStateHandler.hasPlayerJoined(user.id)) {
            this.messageHelper.replyToInteraction(interaction, 'Du er allerede med i spillet', {ephemeral: true})
        } else {
            this.gameStateHandler.addUniquePlayer({id: user.id, playerName: interaction.user.username, hand: [], stake: stake})
        }
    }
    // private startBlackjack(interaction: ChatInputCommandInteraction<CacheType>) {
    //     // const player: BlackjackPlayer = {
    //     //     id: interaction.user.id,
    //     //     playerName: interaction.user.username,
    //     //     hand: [],
    //     // }

    //     // // Deal initial cards to the player
    //     // this.dealCard(player)
    //     // this.dealCard(player)

    //     // // Check if player has blackjack
    //     // if (this.calculateHandValue(player.hand) === 21) {
    //     //     interaction.reply(`Congratulations ${player.playerName}! You have blackjack!`)
    //     //     return
    //     // }

    //     // Deal initial cards to the dealer
    //     this.dealer = {
    //         id: 'dealer',
    //         playerName: 'Bot Høie',
    //         hand: [],
    //     }
    //     this.dealCard(this.dealer)
    //     this.dealCard(this.dealer)

    //     // Show player's hand and one of the dealer's cards
    //     interaction.reply(`Your hand: ${player.hand.join(', ')}`)
    //     interaction.followUp(`Dealer's hand: ${dealer.hand[0]}, ?`)
    // }

    private async dealCard(player: BlackjackPlayer) {
        // draw a card and add it to the player's hand
        const card = await this.deck.drawCard()
        player.hand.push(card)
    }

    private calculateHandValue(hand: ICardObject[]): number {
        // Calculate the value of a hand in blackjack
        let value = 0
        let hasAce = false

        for (const card of hand) {
            if (card.rank === 'A') {
                value += 11
                hasAce = true
            } else if (['T', 'J', 'Q', 'K'].includes(card.rank)) {
                value += 10
            } else {
                value += parseInt(card.rank)
            }
        }
        // Adjust the value if the hand contains an Ace
        if (value > 21 && hasAce) {
            value -= 10
        }
        return value
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'blackjack',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            // this.startBlackjack(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
