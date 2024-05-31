import { CacheType, ChatInputCommandInteraction } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { GameStateHandler } from '../../handlers/gameStateHandler'
import { IInteractionElement } from '../../interfaces/interactionInterface'
interface BlackjackPlayer {
    id: string
    playerName: string
    hand: string[]
}
export class Blackjack extends AbstractCommands {
    private gameStateHandler: GameStateHandler<BlackjackPlayer>

    constructor(client: MazariniClient) {
        super(client)
        this.gameStateHandler = new GameStateHandler<BlackjackPlayer>()
    }
    private startBlackjack(interaction: ChatInputCommandInteraction<CacheType>) {
        const player: BlackjackPlayer = {
            id: interaction.user.id,
            playerName: interaction.user.username,
            hand: [],
        }

        // Deal initial cards to the player
        this.dealCard(player)
        this.dealCard(player)

        // Check if player has blackjack
        if (this.calculateHandValue(player.hand) === 21) {
            interaction.reply(`Congratulations ${player.playerName}! You have blackjack!`)
            return
        }

        // Deal initial cards to the dealer
        const dealer: BlackjackPlayer = {
            id: 'dealer',
            playerName: 'Dealer',
            hand: [],
        }
        this.dealCard(dealer)
        this.dealCard(dealer)

        // Show player's hand and one of the dealer's cards
        interaction.reply(`Your hand: ${player.hand.join(', ')}`)
        interaction.followUp(`Dealer's hand: ${dealer.hand[0]}, ?`)
    }

    private dealCard(player: BlackjackPlayer) {
        // Generate a random card and add it to the player's hand
        const card = this.generateRandomCard()
        player.hand.push(card)
    }

    private generateRandomCard(): string {
        // Generate a random card from a deck of cards
        const cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        const randomIndex = Math.floor(Math.random() * cards.length)
        return cards[randomIndex]
    }

    private calculateHandValue(hand: string[]): number {
        // Calculate the value of a hand in blackjack
        let value = 0
        let hasAce = false

        for (const card of hand) {
            if (card === 'A') {
                value += 11
                hasAce = true
            } else if (card === 'K' || card === 'Q' || card === 'J') {
                value += 10
            } else {
                value += parseInt(card)
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
                            this.startBlackjack(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
