import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, EmbedBuilder, InteractionResponse, Message } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { GameStateHandler, GamePlayer } from '../../handlers/gameStateHandler'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { CardCommands, ICardObject } from './cardCommands'
import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
import { randomUUID } from 'crypto'
import { EmbedUtils } from '../../utils/embedUtils'
import { EmojiHelper } from '../../helpers/emojiHelper'
import { ChannelIds } from '../../utils/mentionUtils'
interface BlackjackPlayer extends GamePlayer {
    id: string
    playerName: string
    hand: ICardObject[]
    stake?: number
    stand?: boolean
    profilePicture: string
    allIn: boolean
}

interface BlackjackGame {
    id: string
    players: BlackjackPlayer[]
    dealer: BlackjackPlayer
    deck: CardCommands
    gameStateHandler?: GameStateHandler<BlackjackPlayer>
    messages: BlackjackMessages
    resolved: boolean
}

interface BlackjackMessages {
    embed?: Message | InteractionResponse
    embedContent: EmbedBuilder
    table?: Message
    tableContent: string
    buttons?: Message
    buttonRow: ActionRowBuilder<ButtonBuilder>
}

enum Event {
    Hit = 'Hit',
    Stand = 'Stand',
    Bust = 'Bust',
    Blackjack = 'Blackjack'
}

export class Blackjack extends AbstractCommands {
    // private gameStateHandler: GameStateHandler<BlackjackPlayer>
    // private deck: CardCommands
    private games: BlackjackGame[]
    // private dealer: BlackjackPlayer
    private faceCard: string

    constructor(client: MazariniClient) {
        super(client)
        // this.gameStateHandler = new GameStateHandler<BlackjackPlayer>()
        this.games = new Array<BlackjackGame>()
        // this.deck = new CardCommands(client, 6)
    }

    // private async buyIn(interaction: ChatInputCommandInteraction<CacheType>) {
    //     const user = await this.client.database.getUser(interaction.user.id)
    //     let userMoney = user.chips
    //     const stake = SlashCommandHelper.getCleanNumberValue(interaction.options.get('satsing')?.value)
    //     if (Number(stake) > Number(userMoney) || !userMoney || userMoney < 0) {
    //         this.messageHelper.replyToInteraction(interaction, 'Du har ikke nok penger til å gamble så mye. Ta å spin fidget spinneren litt for någe cash', {ephemeral: true})
    //     } else if (this.gameStateHandler.hasPlayerJoined(user.id)) {
    //         this.messageHelper.replyToInteraction(interaction, 'Du er allerede med i spillet', {ephemeral: true})
    //     } else {
    //         const profilePicture = (await EmojiHelper.getEmoji(interaction.user.username, this.client)).id
    //         this.gameStateHandler.addUniquePlayer({id: user.id, playerName: interaction.user.username, hand: [], stake: stake, profilePicture: profilePicture})
    //     }
    // }

    private async simpleGame(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('satsing')?.value)
        const userMoney = user.chips
        let stake = amount

        if (!amount || amount > userMoney || isNaN(amount)) stake = userMoney
        if (amount < 1) stake = 1
        if (userMoney && userMoney >= stake) {
            this.client.bank.takeMoney(user, stake)

            const playerPicture = await this.getProfilePicture(interaction)
            const player: BlackjackPlayer = {id: user.id, playerName: interaction.user.username, hand: new Array<ICardObject>, stake: stake, profilePicture: playerPicture, allIn: !amount}
            
            const dealerPicture = (await EmojiHelper.getEmoji('mazarinibot', this.client)).id
            const dealer: BlackjackPlayer = {id: 'dealer', playerName: 'Bot Høie', hand: new Array<ICardObject>, stake: stake, profilePicture: dealerPicture, allIn: false}
            
            const messages: BlackjackMessages = { embedContent: undefined, tableContent: undefined, buttonRow: undefined }
            const game: BlackjackGame = { id: randomUUID(), players: [player], dealer: dealer, deck: new CardCommands(this.client, 6), messages: messages, resolved: false }
            this.games.push(game)

            await this.dealCard(game, player)
            await this.dealCard(game, player)
            await this.dealCard(game, dealer)
            await this.dealCard(game, dealer)

            this.faceCard = (await EmojiHelper.getEmoji('faceCard', this.client)).id

            await this.generateSimpleTable(game)
            this.printGame(game, interaction)
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du må ha minst 1 chip for å spille blackjack :'(`)
        }
    }

    private async getProfilePicture(interaction: ChatInputCommandInteraction<CacheType>) {
        let emoji = await EmojiHelper.getEmoji(interaction.user.username, this.client)
        if (!(emoji.id === '<Fant ikke emojien>')) return emoji.id
        else {
            await EmojiHelper.createProfileEmoji(interaction)
            emoji = await EmojiHelper.getEmoji(interaction.user.username, this.client)
            return emoji.id
        }
    }

    private async generateSimpleTable(game: BlackjackGame) {
        const player = game.players[0]
        const dealer = game.dealer
        const chips = await EmojiHelper.getEmoji('chips', this.client)
        const embed = new EmbedBuilder()
        .setTitle(`Blackjack`).setThumbnail('https://cdn.discordapp.com/attachments/1106130420308922378/1263758500564172872/hoie.png?ex=669b6652&is=669a14d2&hm=34702fa6ce9aa9bafb5300909fc4e455de08931106dc3a5a64a24d49dece95b2&')
        .setDescription(`Du har satset ${player.stake} chips ${chips.id}`)
        const board = `${dealer.profilePicture}\t${dealer.hand[0].emoji} ${this.faceCard}`
        + `\n\n\n${player.profilePicture}\t${player.hand[0].emoji} ${player.hand[1].emoji}`
        game.messages.embedContent = embed
        game.messages.tableContent = board
        game.messages.buttonRow = hitStandButtonRow(game.id)
    }

    private async printGame(game: BlackjackGame, interaction?: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        game.messages.embed = game.messages.embed 
                            ? await game.messages.embed.edit({ embeds: [game.messages.embedContent]})
                            : await this.messageHelper.replyToInteraction(interaction, game.messages.embedContent)
        game.messages.table = game.messages.table 
                            ? await game.messages.table.edit({ content: game.messages.tableContent})
                            : await this.messageHelper.sendMessage(interaction?.channelId, { text: game.messages.tableContent}) 
        game.messages.buttons = game.messages.buttons 
                              ? await game.messages.buttons.edit({ components: [game.messages.buttonRow]})
                              : await this.messageHelper.sendMessage(interaction?.channelId, { components: [game.messages.buttonRow]})
    }

    private async updateBoard(game: BlackjackGame, reveal: boolean) {
        const player = game.players[0]
        const dealer = game.dealer
        let board = `${dealer.profilePicture}\t`
        if (!reveal) board += `${dealer.hand[0].emoji} ${this.faceCard}`
        else dealer.hand.forEach(card => board += `${card.emoji} `)
        board += `\n\n\n${player.profilePicture}\t`
        player.hand.forEach(card => board += `${card.emoji} `)
        game.messages.tableContent = board
        game.messages.table.edit({ content: board })
    }

    private async hit(game: BlackjackGame, player: BlackjackPlayer) {
        await this.dealCard(game, player)
        await this.updateBoard(game, false)
        const handValue = this.calculateHandValue(player.hand)
        if (handValue > 21) this.busted(game, player)
    }

    private async stand(game: BlackjackGame, player: BlackjackPlayer) {
        let dealer = game.dealer
        const naturalBlackJack = (player.hand.length == 2) && (this.calculateHandValue(player.hand) == 21) && (this.calculateHandValue(dealer.hand) != 21)
        if (!naturalBlackJack) {
            while (this.calculateHandValue(dealer.hand) < 17) {
                await this.dealCard(game, dealer)
            }
        }
        await this.updateBoard(game, true)
        this.resolveGame(game, naturalBlackJack)
    }

    private async resolveGame(game: BlackjackGame, naturalBlackJack: boolean) {
        const mb = ':moneybag:'
        const player = game.players[0]
        const dealer = game.dealer
        const dealerHand = this.calculateHandValue(dealer.hand)
        const playerHand = this.calculateHandValue(player.hand)
        if (naturalBlackJack) {
            game.messages.embedContent = game.messages.embedContent.setDescription(`${mb} Du fikk en naturlig blackjack og vinner ${player.stake * 3} chips! ${mb}`)
            this.rewardPlayer(player, player.stake * 3)
        } else if (playerHand == 21 && dealerHand != 21) {
            game.messages.embedContent = game.messages.embedContent.setDescription(`Dealer fikk **${dealerHand}**\n\n${mb} Du fikk blackjack og vinner ${player.stake * 3} chips! ${mb}`)
            this.rewardPlayer(player, player.stake * 3)
        } else if (dealerHand < playerHand || dealerHand > 21) {
            game.messages.embedContent = game.messages.embedContent.setDescription(`Dealer fikk **${dealerHand}**\n\n${mb} Du vinner ${player.stake * 2} chips! ${mb}`)
            this.rewardPlayer(player, player.stake * 2)
        } else if (dealerHand == playerHand) {
            game.messages.embedContent = game.messages.embedContent.setDescription(`Dealer fikk **${dealerHand}** - samme som deg\n\n:recycle: Du får tilbake innsatsen på ${player.stake} chips :recycle:`)
            this.rewardPlayer(player, player.stake)
        } else if (dealerHand > playerHand) {
            game.messages.embedContent = game.messages.embedContent.setDescription(`Dealer fikk **${dealerHand}**\n\n:money_with_wings: Du tapte ${player.stake} chips :money_with_wings:`)
        }
        game.messages.buttonRow = gameFinishedRow(game.id)
        game.messages.embed.edit({ embeds: [game.messages.embedContent]})
        game.messages.buttons.edit({ components: [game.messages.buttonRow]})
        game.resolved = true
    }

    private async rewardPlayer(player: BlackjackPlayer, amount: number) {
        const user = await this.client.database.getUser(player.id)
        this.client.bank.giveUnrestrictedMoney(user, amount)
    }

    private async busted(game: BlackjackGame, player: BlackjackPlayer) {
        const user = await this.client.database.getUser(player.id)
        game.messages.buttonRow = gameFinishedRow(game.id)
        game.messages.buttons.edit({ components: [game.messages.buttonRow]})
        game.messages.embedContent = game.messages.embedContent.setTitle('Busted').setDescription(`Du trakk over 21\n\n:money_with_wings: Du tapte ${player.stake} chips :money_with_wings:`)
        game.messages.embed.edit({ embeds: [game.messages.embedContent]})
        game.resolved = true
    }

    private async deleteGame(game: BlackjackGame) {
        await game.messages.buttons.delete()
        // await game.messages.embed.delete()
        await game.messages.table.delete()
        const index = this.games.findIndex(elem => elem.id == game.id)
        this.games.splice(index, 1)
    }

    private async playAgain(interaction: ButtonInteraction<CacheType>, game: BlackjackGame, player: BlackjackPlayer) {
        const user = await this.client.database.getUser(player.id)
        player.stake = player.allIn ? user.chips : player.stake
        if (!this.client.bank.userCanAfford(user, player.stake)) {
            const emoji = await EmojiHelper.getEmoji('arneouf', this.client)
            game.messages.embedContent = game.messages.embedContent.setThumbnail(`https://cdn.discordapp.com/emojis/${emoji.urlId}.webp?size=96&quality=lossless`).setDescription(`Du har ikke råd til en ny`)
            await game.messages.embed.edit({ embeds: [game.messages.embedContent]})
        } else {
            game.resolved = false
            this.client.bank.takeMoney(user, player.stake)

            game.dealer.hand = new Array<ICardObject>
            player.hand = new Array<ICardObject>

            await this.dealCard(game, player)
            await this.dealCard(game, player)
            await this.dealCard(game, game.dealer)
            await this.dealCard(game, game.dealer)

            await this.generateSimpleTable(game)
            this.printGame(game, interaction)
        }
    }

    private getGame(interaction: ButtonInteraction<CacheType>) {
        const gameId = interaction.customId.split(';')[1]
        return this.games.find(game => game.id == gameId)
    }

    private getPlayer(interaction: ButtonInteraction<CacheType>, game: BlackjackGame) {
        return game.players.find(player => player.id == interaction.user.id)
    }

    // private getEventString(event: Event) {
    //     const player = this.gameStateHandler.getCurrentPlayer()
    //     if (event == Event.Hit) return `${player.playerName} trakk ${player.hand[player.hand.length-1].emoji} og har nå ${this.calculateHandValue(player.hand)}`
    //     if (event == Event.Bust) return `:x: ${player.playerName} trakk ${player.hand[player.hand.length-1].emoji} og har nå ${this.calculateHandValue(player.hand)} :x:`
    //     if (event == Event.Stand) return `${player.playerName} valgte å stå på ${this.calculateHandValue(player.hand)}`
    //     if (event == Event.Blackjack) return `${player.playerName} trakk ${player.hand[player.hand.length-1].emoji} og har blackjack!`
    // }

    private async dealCard(game: BlackjackGame, player: BlackjackPlayer) {
        // draw a card and add it to the player's hand
        const card = await game.deck.drawCard()
        player.hand.push(card)
    }

    private calculateHandValue(hand: ICardObject[]): number {
        // Calculate the value of a hand in blackjack
        let value = 0
        let aces = 0

        for (const card of hand) {
            if (card.rank === 'A') {
                value += 11
                aces += 1
            } else if (['T', 'J', 'Q', 'K'].includes(card.rank)) {
                value += 10
            } else {
                value += parseInt(card.rank)
            }
        }
        // Adjust the value if the hand contains an Ace
        let i = 0
        while (value > 21 && aces > i) {
            value -= 10
            i++
        }
        return value
    }

    // private checkIfPlayersTurn(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
    //     const player = this.gameStateHandler.getPlayer(interaction.user.id)
    //     if (!player) this.messageHelper.replyToInteraction(interaction, 'Du er ikke med i dette spillet', {ephemeral: true})
    //     else if (!this.gameStateHandler.isPlayersTurn(player)) this.messageHelper.replyToInteraction(interaction, 'Det er ikke din tur', {ephemeral: true})
    //     else {
    //         if (interaction.isButton()) interaction.deferUpdate()
    //         return player
    //     }
    // } 

    private verifyUserAndCallMethod(interaction: ButtonInteraction<CacheType>, callback: (game, player) => void) {
        const game = this.getGame(interaction)
        const player = this.getPlayer(interaction, game)
        if (player) {
            interaction.deferUpdate()
            callback(game, player)
        }
        else this.messageHelper.replyToInteraction(interaction, 'du er ikke med i dette spillet', {ephemeral: true})
    }

    private async returnStakes() {
        await this.messageHelper.sendMessage(ChannelIds.LAS_VEGAS, {text: 'Kasinoet stenger raskt for en liten restart. Beklager ulempen dette medfører. Alle innsatser er returnert.'})
        this.games.filter(game => !game.resolved).forEach(async game => {
            game.players.forEach(async player => {
                const user = await this.client.database.getUser(player.id)
                user.chips += player.stake
                this.client.database.updateUser(user) 
            })
        })
    }

    override async onSave() {
        await this.returnStakes()
        return true
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'blackjack',
                        command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                            const subCommand = interaction.options.getSubcommand()
                            if (subCommand.toLowerCase() === 'solo') this.simpleGame(interaction)
                            else if (subCommand.toLowerCase() === 'vanlig') this.messageHelper.replyToInteraction(interaction, 'Denne er ikke klar enda', {ephemeral: true})
                        },
                    },
                ],
                buttonInteractionComands: [
                    {
                        commandName: 'BLACKJACK_HIT',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.hit(game, player))
                        },
                    },
                    {
                        commandName: 'BLACKJACK_STAND',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.stand(game, player))
                        },
                    },
                    {
                        commandName: 'BLACKJACK_REMOVE',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.deleteGame(game))
                        },
                    },
                    {
                        commandName: 'BLACKJACK_PLAY_AGAIN',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.playAgain(interaction, game, player))
                        },
                    },
                ],
            },
        }
    }
}

const hitStandButtonRow = (id: string) => new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `BLACKJACK_HIT;${id}`,
        style: ButtonStyle.Primary,
        label: `Trekk`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `BLACKJACK_STAND;${id}`,
        style: ButtonStyle.Success,
        label: `Stå`,
        disabled: false,
        type: 2,
    })
)

const gameFinishedRow = (id: string) => new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `BLACKJACK_PLAY_AGAIN;${id}`,
        style: ButtonStyle.Success,
        label: `Nytt spill`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `BLACKJACK_REMOVE;${id}`,
        style: ButtonStyle.Primary,
        label: `Ferdig`,
        disabled: false,
        type: 2,
    })
)