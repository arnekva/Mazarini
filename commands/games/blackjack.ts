import { randomUUID } from 'crypto'
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    InteractionResponse,
    Message,
} from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { MazariniClient } from '../../client/MazariniClient'
import { GameValues } from '../../general/Values'
import { GamePlayer, GameStateHandler } from '../../handlers/gameStateHandler'
import { DatabaseHelper } from '../../helpers/databaseHelper'
import { EmojiHelper, emojiReturnType } from '../../helpers/emojiHelper'
import { SlashCommandHelper } from '../../helpers/slashCommandHelper'
import { MazariniUser } from '../../interfaces/database/databaseInterface'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { MentionUtils } from '../../utils/mentionUtils'
import { CardCommands, ICardObject } from './cardCommands'
interface BlackjackPlayer extends GamePlayer {
    id: string
    name: string
    hands: PlayerHand[]
    currentHandIndex: number
    stake?: number
    profilePicture: string
    allIn: boolean
    insurance?: boolean
    gameWinnings?: number
}

interface PlayerHand {
    cards: ICardObject[]
    stand: boolean
    doubleDown: boolean
    isSplitAce?: boolean
}

interface BlackjackDealer {
    id: string
    name: string
    hand: ICardObject[]
    profilePicture: string
}

interface BlackjackGame {
    id: string
    players: BlackjackPlayer[]
    dealer: BlackjackDealer
    deck: CardCommands
    gameStateHandler?: GameStateHandler<BlackjackPlayer>
    messages: BlackjackMessages
    resolved: boolean
    fromDeathroll?: number
    hasRedealt?: boolean
}

interface BlackjackMessages {
    embed?: Message | InteractionResponse
    embedContent: EmbedBuilder
    table?: Message
    tableContent: string
    buttons?: Message
    buttonRow: ActionRowBuilder<ButtonBuilder>
}

export class Blackjack extends AbstractCommands {
    private games: BlackjackGame[]
    private faceCard: string
    private arrowEmoji: emojiReturnType

    constructor(client: MazariniClient) {
        super(client)
        this.games = new Array<BlackjackGame>()
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
    //         this.gameStateHandler.addUniquePlayer({id: user.id, name: interaction.user.username, hand: [], stake: stake, profilePicture: profilePicture})
    //     }
    // }

    private async getArrowEmoji() {
        this.arrowEmoji = this.arrowEmoji ?? (await EmojiHelper.getApplicationEmoji('arrow_left', this.client))
        return this.arrowEmoji
    }

    private async deathrollBlackjack(interaction: ButtonInteraction<CacheType>) {
        const userId = interaction.customId.split(';')[1]
        if (userId !== interaction.user.id) {
            interaction.deferUpdate()
        } else {
            const stake = Number(interaction.customId.split(';')[2])
            const user = await this.client.database.getUser(userId)
            if (this.client.bank.takeMoney(user, stake)) {
                await this.setupGame(interaction, user, stake, false, stake)
            } else {
                const huh = await EmojiHelper.getEmoji('kekhuh', interaction)
                this.messageHelper.replyToInteraction(interaction, 'Du kan ikke gamble chipsene hvis du allerede har mistet dem ' + huh.id)
            }
            interaction.message.delete()
        }
    }

    private async setupGame(
        interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>,
        user: MazariniUser,
        stake: number,
        allIn: boolean,
        isDeathrollPot: number = 0
    ) {
        const playerPicture = await this.getProfilePicture(interaction)
        const hand: PlayerHand = { cards: new Array<ICardObject>(), stand: false, doubleDown: false }
        const player: BlackjackPlayer = {
            id: user.id,
            name: interaction.user.username,
            hands: [hand],
            currentHandIndex: 0,
            stake: stake,
            profilePicture: playerPicture,
            allIn: allIn,
        }

        const dealerPicture = (await EmojiHelper.getEmoji('mazarinibot', this.client)).id
        const dealer: BlackjackDealer = { id: 'dealer', name: 'Bot Høie', hand: new Array<ICardObject>(), profilePicture: dealerPicture }

        const messages: BlackjackMessages = { embedContent: undefined, tableContent: undefined, buttonRow: undefined }
        const game: BlackjackGame = {
            id: randomUUID(),
            players: [player],
            dealer: dealer,
            deck: new CardCommands(this.client, 6),
            messages: messages,
            resolved: false,
            fromDeathroll: isDeathrollPot,
            hasRedealt: false,
        }
        this.games.push(game)

        await this.dealCard(game, player.hands[0].cards)
        await this.dealCard(game, player.hands[0].cards)

        await this.dealCard(game, dealer.hand)
        await this.dealCard(game, dealer.hand)
        if (!!isDeathrollPot && dealer.hand.some((card) => card.rank === 'A')) {
            dealer.hand = new Array<ICardObject>()
            await this.dealCard(game, dealer.hand)
            await this.dealCard(game, dealer.hand)
        }

        this.faceCard = (await EmojiHelper.getEmoji('faceCard', this.client)).id

        await this.generateSimpleTable(game)
        await this.printGame(game, interaction)
    }

    private async simpleGame(interaction: ChatInputCommandInteraction<CacheType>) {
        const user = await this.client.database.getUser(interaction.user.id)
        const amount = SlashCommandHelper.getCleanNumberValue(interaction.options.get('satsing')?.value)
        const userMoney = user.chips
        let stake = amount
        const didntSpecifyAmount = !amount || amount > userMoney || isNaN(amount)
        if (didntSpecifyAmount && user.userSettings?.safeGambleValue && userMoney >= user.userSettings.safeGambleValue) {
            this.messageHelper.replyToInteraction(
                interaction,
                `Din grensa e på ${user.userSettings.safeGambleValue}, og du har ${user.chips} chips. Du må skriva inn beløpet manuelt for å spela.`
            )
        } else {
            if (didntSpecifyAmount) stake = userMoney
            if (amount < 1) stake = 1
            if (userMoney && userMoney >= stake) {
                this.client.bank.takeMoney(user, stake)
                this.setupGame(interaction, user, stake, !amount)
            } else {
                this.messageHelper.replyToInteraction(interaction, `Du må ha minst 1 chip for å spille blackjack :'(`)
            }
        }
    }

    private async getProfilePicture(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        let emoji = await EmojiHelper.getEmoji(interaction.user.username.replace('.', ''), this.client)
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
            .setTitle(`Blackjack`)
            .setThumbnail(
                'https://cdn.discordapp.com/attachments/1106130420308922378/1263758500564172872/hoie.png?ex=669b6652&is=669a14d2&hm=34702fa6ce9aa9bafb5300909fc4e455de08931106dc3a5a64a24d49dece95b2&'
            )
            .setDescription(`Du har satset ${player.stake} chips ${chips.id}`)
        const board =
            `${dealer.profilePicture}\t${dealer.hand[0].emoji} ${this.faceCard}` +
            `\n\n\n${player.profilePicture}\t${player.hands[0].cards[0].emoji} ${player.hands[0].cards[1].emoji}`
        game.messages.embedContent = embed
        game.messages.tableContent = board
        game.messages.buttonRow = await this.getButtonRow(game, player)
    }

    private async printGame(
        game: BlackjackGame,
        interaction?: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>,
        deferred: boolean = false
    ) {
        if (game.messages.embed) {
            game.messages.embed = await game.messages.embed.edit({ embeds: [game.messages.embedContent] })
        } else if (deferred) {
            game.messages.embed = await this.messageHelper.sendMessage(interaction?.channelId, { embed: game.messages.embedContent })
        } else {
            game.messages.embed = await this.messageHelper.replyToInteraction(interaction, game.messages.embedContent, { hasBeenDefered: deferred })
        }
        game.messages.table = game.messages.table
            ? await game.messages.table.edit({ content: game.messages.tableContent })
            : await this.messageHelper.sendMessage(interaction?.channelId, { text: game.messages.tableContent })
        game.messages.buttons = game.messages.buttons
            ? await game.messages.buttons.edit({ components: [game.messages.buttonRow] })
            : await this.messageHelper.sendMessage(interaction?.channelId, { components: [game.messages.buttonRow] })
    }

    private async moveGameDown(interaction: ButtonInteraction<CacheType>, game: BlackjackGame) {
        await game.messages.embed.delete()
        game.messages.embed = undefined
        await game.messages.table.delete()
        game.messages.table = undefined
        await game.messages.buttons.delete()
        game.messages.buttons = undefined
        game.messages.buttonRow = await this.getButtonRow(game, game.players[0])
        await this.printGame(game, interaction, true)
    }

    private async getButtonRow(game: BlackjackGame, player: BlackjackPlayer) {
        const buttonRow = hitStandButtonRow(game.id)
        const hasDeathrollRedeal = !!game.fromDeathroll && !game.hasRedealt
        if (player.hands[player.currentHandIndex].cards.length === 2) {
            const user = await this.client.database.getUser(player.id)
            if (this.canDoubleDown(player.hands[player.currentHandIndex]))
                buttonRow.addComponents(doubleDownBtn(game.id, this.client.bank.userCanAfford(user, player.stake)))
            if (this.canSplit(player.hands[player.currentHandIndex].cards))
                buttonRow.addComponents(splitBtn(game.id, this.client.bank.userCanAfford(user, player.stake)))
            if (this.canInsure(game, player)) buttonRow.addComponents(insuranceBtn(game.id, this.client.bank.userCanAfford(user, Math.ceil(player.stake / 2))))
            if (this.canReDeal(player, user) || hasDeathrollRedeal) {
                const reDeals = (user.effects?.positive?.blackjackReDeals ?? 0) + (hasDeathrollRedeal ? 1 : 0)
                buttonRow.addComponents(reDealBtn(game.id, reDeals))
            }
        }
        buttonRow.addComponents(moveDownBtn(game.id))
        return buttonRow
    }

    private canDoubleDown(hand: PlayerHand) {
        if (hand.doubleDown) return false
        const handValue = this.calculateHandValue(hand.cards)
        return hand.cards.length === 2 && handValue >= 9 && handValue <= 11
    }

    private canSplit(hand: ICardObject[]) {
        if (hand.length !== 2) return false
        return hand[0].number === hand[1].number || (['T', 'J', 'Q', 'K'].includes(hand[0].rank) && ['T', 'J', 'Q', 'K'].includes(hand[1].rank))
    }

    private canInsure(game: BlackjackGame, player: BlackjackPlayer) {
        return !player.insurance && game.dealer.hand[0].rank === 'A'
    }

    private canReDeal(player: BlackjackPlayer, user: MazariniUser) {
        return player.hands.length === 1 && player.hands[0].cards.length === 2 && (user.effects?.positive?.blackjackReDeals ?? 0) > 0
    }

    private async updateBoard(game: BlackjackGame, reveal: boolean) {
        const player = game.players[0]
        const dealer = game.dealer
        const allHandsBusted = player.hands.every((hand) => this.calculateHandValue(hand.cards) > 21)
        const arrow = await this.getArrowEmoji()
        let board = `${dealer.profilePicture}\t`
        if (!reveal) board += `${dealer.hand[0].emoji} ${this.faceCard}`
        else dealer.hand.forEach((card) => (board += `${card.emoji} `))
        board += `\n`
        player.hands.forEach((hand, index) => {
            board += `\n\n${player.profilePicture}\t`
            hand.cards.forEach((card) => (board += `${card.emoji} `))
            if (!allHandsBusted && index === player.currentHandIndex && player.hands.length > 1) board += ` ${arrow.id}`
        })
        game.messages.tableContent = board
        game.messages.table.edit({ content: board })
        if (!reveal && !allHandsBusted) {
            game.messages.buttonRow = await this.getButtonRow(game, player)
            game.messages.buttons.edit({ components: [game.messages.buttonRow] })
        }
    }

    private async updateButtons(game: BlackjackGame, player: BlackjackPlayer) {
        game.messages.buttonRow = await this.getButtonRow(game, player)
        await game.messages.buttons.edit({ components: [game.messages.buttonRow] })
    }

    private async hit(game: BlackjackGame, player: BlackjackPlayer) {
        await this.dealCard(game, player.hands[player.currentHandIndex].cards)
        this.updateBoard(game, false)
        const handValue = this.calculateHandValue(player.hands[player.currentHandIndex].cards)
        const busted = handValue > 21
        const drawCapped = this.drawIsCapped(player.hands[player.currentHandIndex])
        if (busted || drawCapped) {
            if (busted && player.hands.length === 1) await this.busted(game, player)
            else if (player.currentHandIndex < player.hands.length - 1) {
                player.currentHandIndex++
                this.updateEmbed(game, player)
                this.updateButtons(game, player)
            } else this.dealToDealer(game, player)
        }
    }

    private drawIsCapped(hand: PlayerHand) {
        const splitAceCase = hand.isSplitAce && hand.cards.length === 2
        const doubledDownCase = hand.doubleDown && hand.cards.length === 3
        return splitAceCase || doubledDownCase
    }

    private stand(game: BlackjackGame, player: BlackjackPlayer) {
        if (player.currentHandIndex < player.hands.length - 1) {
            player.currentHandIndex++
            // this.dealCard(game, player.hands[player.currentHandIndex].cards)
            this.updateEmbed(game, player)
            this.updateBoard(game, false)
        } else this.dealToDealer(game, player)
    }

    private async dealToDealer(game: BlackjackGame, player: BlackjackPlayer) {
        const dealer = game.dealer
        const allHandsBusted = player.hands.every((hand) => this.calculateHandValue(hand.cards) > 21)
        const naturalBlackJack =
            player.hands.length === 1 &&
            player.hands[player.currentHandIndex].cards.length == 2 &&
            this.calculateHandValue(player.hands[player.currentHandIndex].cards) == 21 &&
            this.calculateHandValue(dealer.hand) != 21
        if (!naturalBlackJack && !allHandsBusted) {
            while (this.calculateHandValue(dealer.hand) < 17) {
                await this.dealCard(game, dealer.hand)
            }
        }
        this.updateBoard(game, !allHandsBusted)
        this.resolveGame(game, naturalBlackJack)
    }

    private checkInsurance(game: BlackjackGame, player: BlackjackPlayer) {
        const dealerBlackjack = game.dealer.hand[0].rank === 'A' && game.dealer.hand[1].number === 10
        return player.insurance && dealerBlackjack ? Math.floor(player.stake * 1.5) : 0
    }

    private async split(interaction: ButtonInteraction<CacheType>, game: BlackjackGame, player: BlackjackPlayer) {
        const user = await this.client.database.getUser(player.id)
        if (!this.client.bank.takeMoney(user, player.stake))
            return this.messageHelper.sendMessage(interaction.channelId, { text: `Du har ikke råd til en split, ${MentionUtils.mentionUser(user.id)}` })
        const isAce = player.hands[player.currentHandIndex].cards[1].rank === 'A'
        const newHand: PlayerHand = { cards: [player.hands[player.currentHandIndex].cards[1]], stand: false, doubleDown: false, isSplitAce: isAce }
        player.hands[player.currentHandIndex].cards = [player.hands[player.currentHandIndex].cards[0]]
        player.hands[player.currentHandIndex].isSplitAce = isAce
        player.hands.push(newHand)
        this.updateEmbed(game, player)
        this.updateBoard(game, false)
    }

    private async doubleDown(interaction: ButtonInteraction<CacheType>, game: BlackjackGame, player: BlackjackPlayer) {
        const user = await this.client.database.getUser(player.id)
        if (!this.client.bank.takeMoney(user, player.stake))
            return this.messageHelper.sendMessage(interaction.channelId, { text: `Du har ikke råd til å double down, ${MentionUtils.mentionUser(user.id)}` })
        player.hands[player.currentHandIndex].doubleDown = true
        this.updateEmbed(game, player)
        this.updateButtons(game, player)
    }

    private async insurance(interaction: ButtonInteraction<CacheType>, game: BlackjackGame, player: BlackjackPlayer) {
        const user = await this.client.database.getUser(player.id)
        if (!this.client.bank.takeMoney(user, Math.ceil(player.stake / 2)))
            return this.messageHelper.sendMessage(interaction.channelId, { text: `Du har ikke råd til insurance, ${MentionUtils.mentionUser(user.id)}` })
        player.insurance = true
        this.updateEmbed(game, player)
        this.updateButtons(game, player)
    }

    private async updateEmbed(game: BlackjackGame, player: BlackjackPlayer) {
        const currentHand = player.hands.length !== 1 ? `\nSpiller på ${player.currentHandIndex + 1}. hånd` : ''
        const insurance = player.insurance ? '\nInsurance er kjøpt' : ''
        const chips = await EmojiHelper.getEmoji('chips', this.client)
        let description = ''
        for (let i = 0; i < player.hands.length; i++) {
            const gameNr = player.hands.length > 1 ? `på ${i + 1}. hånd ` : ''
            const bet = player.hands[i].doubleDown ? `doubled down på` : 'satset'
            description += `Du har ${bet} ${player.stake} chips ${gameNr}${chips.id}\n`
        }
        description += insurance + currentHand
        game.messages.embedContent = game.messages.embedContent.setDescription(description)
        await game.messages.embed.edit({ embeds: [game.messages.embedContent] })
    }

    private async resolveGame(game: BlackjackGame, naturalBlackJack: boolean) {
        const mb = ':moneybag:'
        const player = game.players[0]
        const dealer = game.dealer
        const dealerHand = this.calculateHandValue(dealer.hand)
        const user = await this.client.database.getUser(player.id)
        let description = ''
        let reward = 0
        if (naturalBlackJack) {
            description = `${mb} Du fikk en naturlig blackjack og vinner ${Math.floor(player.stake * 2.5)} chips! ${mb}`
            reward = Math.floor(player.stake * 2.5)
            DatabaseHelper.incrementMoneyStats(user, reward, 'won')
        } else {
            description = `Dealer fikk **${dealerHand}**\n\n`
            for (let i = 0; i < player.hands.length; i++) {
                const gameNr = player.hands.length > 1 ? `Game ${i + 1}: ` : ''
                const hand = player.hands[i]
                const playerHand = this.calculateHandValue(hand.cards)
                const stake = player.stake * (hand.doubleDown ? 2 : 1)
                const lostAddedBack =
                    game.fromDeathroll && GameValues.blackjack.deathrollRefundEnabled
                        ? ` Siden du prøvde å gamble ein deathroll pot e halvparten (${Math.floor(game.fromDeathroll * 0.5)}) lagt tebage igjen`
                        : ''
                if (playerHand > 21) {
                    description += `${gameNr}Du fikk ${playerHand} og taper ${stake} chips! :money_with_wings:\n${lostAddedBack}\n`
                    DatabaseHelper.incrementChipsStats(user, 'blackjackLosses')
                    DatabaseHelper.incrementMoneyStats(user, stake, 'lost')
                    this.updatePot(game)
                } else if (dealerHand < playerHand || dealerHand > 21) {
                    description += `${gameNr}Du fikk ${playerHand} og vinner ${stake * 2} chips! ${mb}\n`
                    reward += stake * 2
                    DatabaseHelper.incrementChipsStats(user, 'blackjackWins')
                    DatabaseHelper.incrementMoneyStats(user, stake, 'won')
                } else if (dealerHand == playerHand) {
                    description += `${gameNr}Du fikk ${playerHand} - samme som dealer, og får tilbake innsatsen på ${stake} chips :recycle:\n`
                    DatabaseHelper.incrementChipsStats(user, 'blackjackDraws')
                    reward += stake
                } else if (dealerHand > playerHand) {
                    description += `${gameNr}Du fikk ${playerHand} og taper ${stake} chips :money_with_wings:\n${lostAddedBack}\n`
                    DatabaseHelper.incrementChipsStats(user, 'blackjackLosses')
                    DatabaseHelper.incrementMoneyStats(user, stake, 'lost')
                    this.updatePot(game)
                    if (dealerHand == 21) DatabaseHelper.incrementChipsStats(user, 'blackjackLossDealer21')
                }
                this.database.updateUser(user)
            }
        }
        const insuranceClaim = this.checkInsurance(game, player)
        if (insuranceClaim > 0) {
            description += `Du var klok som kjøpte insurance og får tilbake ${insuranceClaim} chips på den ${mb}`
            reward += insuranceClaim
        }
        player.gameWinnings = reward
        this.rewardPlayer(player, Math.floor(reward))
        game.messages.embedContent = game.messages.embedContent.setDescription(description)
        game.messages.buttonRow = gameFinishedRow(game.id)
        game.messages.embed.edit({ embeds: [game.messages.embedContent] })
        game.messages.buttons.edit({ components: [game.messages.buttonRow] })
        game.resolved = true
    }

    private updatePot(game: BlackjackGame) {
        if (game.fromDeathroll && GameValues.blackjack.deathrollRefundEnabled) {
            this.client.cache.deathrollPot += Math.floor(game.fromDeathroll * 0.5)
        }
    }

    private async rewardPlayer(player: BlackjackPlayer, amount: number) {
        const user = await this.client.database.getUser(player.id)
        this.client.bank.giveUnrestrictedMoney(user, amount)
    }

    private async busted(game: BlackjackGame, player: BlackjackPlayer) {
        player.gameWinnings = 0
        game.messages.buttonRow = gameFinishedRow(game.id)
        game.messages.buttons.edit({ components: [game.messages.buttonRow] })
        if (game.fromDeathroll) {
            this.client.cache.deathrollPot += Math.floor(game.fromDeathroll * 0.5)
        }
        const refundText = game.fromDeathroll
            ? `\nSiden du prøvde å gamble ein deathroll pot e halvparten (${Math.floor(game.fromDeathroll * 0.5)}) lagt tebage igjen`
            : ''
        game.messages.embedContent = game.messages.embedContent
            .setTitle('Busted')
            .setDescription(`Du trakk over 21\n\n:money_with_wings: Du tapte ${player.stake} chips :money_with_wings: ${refundText} `) //
        game.messages.embed.edit({ embeds: [game.messages.embedContent] })
        game.resolved = true
        const user = await this.client.database.getUser(player.id)
        DatabaseHelper.incrementMoneyStats(user, player.stake, 'lost')
        DatabaseHelper.incrementChipsStats(user, 'blackjackLosses')
        this.database.updateUser(user)
    }

    private async deleteGame(game: BlackjackGame) {
        try {
            await game.messages.buttons.delete()
        } catch (e: any) {
            this.client.messageHelper.sendLogMessage(
                'Forsøkte å slette noen blackjack-knapper, men klarte det ikke. Det må vel bety at de aldri eksisterte, sant?'
            )
        }
        try {
            await game.messages.table.delete()
        } catch (e: any) {
            this.client.messageHelper.sendLogMessage('Forsøkte å slette et blackjack-bord, men klarte det ikke. Det må vel bety at det aldri ble dealet, sant?')
        }
        const index = this.games.findIndex((elem) => elem.id == game.id)
        this.games.splice(index, 1)
    }

    private async playAgain(interaction: ButtonInteraction<CacheType>, game: BlackjackGame, player: BlackjackPlayer) {
        const user = await this.client.database.getUser(player.id)
        if (player.allIn) player.stake = user.chips
        else if (game.fromDeathroll) player.stake = player.gameWinnings
        if (!this.client.bank.userCanAfford(user, player.stake)) {
            const emoji = await EmojiHelper.getApplicationEmoji('arneouf', this.client)
            game.messages.embedContent = game.messages.embedContent
                .setThumbnail(`https://cdn.discordapp.com/emojis/${emoji.urlId}.webp?size=96&quality=lossless`)
                .setDescription(`Du har ikke råd til en ny`)
            await game.messages.embed.edit({ embeds: [game.messages.embedContent] })
        } else if (player.stake === 0) {
            game.messages.embedContent = game.messages.embedContent
                .setThumbnail(`https://cdn.discordapp.com/emojis/1255794610433953793.webp?size=96&quality=lossless`)
                .setDescription(`Hasjen er tapt.`)
            await game.messages.embed.edit({ embeds: [game.messages.embedContent] })
        } else {
            game.resolved = false
            game.hasRedealt = false
            this.client.bank.takeMoney(user, player.stake)

            game.dealer.hand = new Array<ICardObject>()
            const hand: PlayerHand = { cards: new Array<ICardObject>(), stand: false, doubleDown: false }
            player.hands = [hand]
            player.currentHandIndex = 0
            player.insurance = false

            await this.dealCard(game, player.hands[player.currentHandIndex].cards)
            await this.dealCard(game, player.hands[player.currentHandIndex].cards)
            await this.dealCard(game, game.dealer.hand)
            await this.dealCard(game, game.dealer.hand)

            if (game.fromDeathroll && game.dealer.hand.some((card) => card.rank === 'A')) {
                game.dealer.hand = new Array<ICardObject>()
                await this.dealCard(game, game.dealer.hand)
                await this.dealCard(game, game.dealer.hand)
            }

            await this.generateSimpleTable(game)
            this.printGame(game, interaction)
        }
    }

    private async reDeal(game: BlackjackGame, player: BlackjackPlayer) {
        const hasDeathrollRedeal = game.fromDeathroll && !game.hasRedealt
        if (hasDeathrollRedeal) {
            game.hasRedealt = true
        } else {
            const user = await this.client.database.getUser(player.id)
            user.effects.positive.blackjackReDeals -= 1
            this.database.updateUser(user)
        }
        game.dealer.hand = new Array<ICardObject>()
        const hand: PlayerHand = { cards: new Array<ICardObject>(), stand: false, doubleDown: false }
        player.hands = [hand]
        player.currentHandIndex = 0
        player.insurance = false
        await this.dealCard(game, player.hands[player.currentHandIndex].cards)
        await this.dealCard(game, player.hands[player.currentHandIndex].cards)
        await this.dealCard(game, game.dealer.hand)
        await this.dealCard(game, game.dealer.hand)
        this.updateBoard(game, false)
    }

    private getGame(interaction: ButtonInteraction<CacheType>) {
        const gameId = interaction.customId.split(';')[1]
        return this.games.find((game) => game.id == gameId)
    }

    private getPlayer(interaction: ButtonInteraction<CacheType>, game: BlackjackGame) {
        return game?.players?.find((player) => player.id == interaction.user.id)
    }

    private async dealCard(game: BlackjackGame, hand: ICardObject[]) {
        // draw a card and add it to the player's hand
        const card = await game.deck.drawCard()
        hand.push(card)
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

    private verifyUserAndCallMethod(
        interaction: ButtonInteraction<CacheType>,
        callback: (game: BlackjackGame, player?: BlackjackPlayer) => void,
        cannotBeDoneAfterCompleted: boolean = false
    ) {
        const game = this.getGame(interaction)

        const player = this.getPlayer(interaction, game)
        if (player && !cannotBeDoneAfterCompleted) {
            interaction.deferUpdate()
            callback(game, player)
        } else if (game.resolved) {
            this.messageHelper.replyToInteraction(interaction, 'Du kan ikke flytte et fullført spill', { ephemeral: true })
        } else this.messageHelper.replyToInteraction(interaction, 'du er ikke med i dette spillet', { ephemeral: true })
    }

    private async returnStakes() {
        for (const game of this.games.filter((game) => !game.resolved)) {
            for (const player of game.players) {
                const user = await this.client.database.getUser(player.id)
                let refundedChips = player.stake * player.hands.length
                if (player.insurance) refundedChips += Math.ceil(player.stake / 2)
                user.chips += refundedChips
                this.client.database.updateUser(user)
                game.messages.embedContent = game.messages.embedContent
                    .setTitle('Stengt')
                    .setDescription(`Kasinoet ble dessverre uanmeldt stengt av en /restart. Du har fått tilbake dine ${refundedChips} chips`)
            }
            try {
                await game.messages.embed.edit({ embeds: [game.messages.embedContent] })
            } catch (e: any) {
                this.client.messageHelper.sendLogMessage(
                    'Forsøkte å redigere en blackjackmelding, men klarte det ikke. Det må vel bety at den aldri eksisterte, sant?'
                )
            }
            await this.deleteGame(game)
        }
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
                            else if (subCommand.toLowerCase() === 'vanlig')
                                this.messageHelper.replyToInteraction(interaction, 'Denne er ikke klar enda', { ephemeral: true })
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
                        commandName: 'BLACKJACK_SPLIT',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.split(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'BLACKJACK_DOUBLE_DOWN',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.doubleDown(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'BLACKJACK_INSURANCE',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.insurance(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'BLACKJACK_REMOVE',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game) => this.deleteGame(game))
                        },
                    },
                    {
                        commandName: 'BLACKJACK_PLAY_AGAIN',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.playAgain(interaction, game, player))
                        },
                    },
                    {
                        commandName: 'BLACKJACK_REDEAL',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game, player) => this.reDeal(game, player))
                        },
                    },
                    {
                        commandName: 'BLACKJACK_DEATHROLL',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.deathrollBlackjack(interaction)
                        },
                    },
                    {
                        commandName: 'BLACKJACK_MOVE_DOWN',
                        command: (interaction: ButtonInteraction<CacheType>) => {
                            this.verifyUserAndCallMethod(interaction, (game) => this.moveGameDown(interaction, game), true)
                        },
                    },
                ],
            },
        }
    }
}

const hitStandButtonRow = (id: string) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
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

const gameFinishedRow = (id: string) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
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
        }),
        moveDownBtn(id)
    )

const doubleDownBtn = (id: string, canAfford: boolean) =>
    new ButtonBuilder({
        custom_id: `BLACKJACK_DOUBLE_DOWN;${id}`,
        style: ButtonStyle.Primary,
        label: `Double Down`,
        disabled: !canAfford,
        type: 2,
    })

const splitBtn = (id: string, canAfford: boolean) =>
    new ButtonBuilder({
        custom_id: `BLACKJACK_SPLIT;${id}`,
        style: ButtonStyle.Primary,
        label: `Split`,
        disabled: !canAfford,
        type: 2,
    })

const insuranceBtn = (id: string, canAfford: boolean) =>
    new ButtonBuilder({
        custom_id: `BLACKJACK_INSURANCE;${id}`,
        style: ButtonStyle.Primary,
        label: `Insurance`,
        disabled: !canAfford,
        type: 2,
    })

const reDealBtn = (id: string, reDealsAvailable: number) =>
    new ButtonBuilder({
        custom_id: `BLACKJACK_REDEAL;${id}`,
        style: ButtonStyle.Primary,
        label: `Deal på nytt (${reDealsAvailable})`,
        disabled: false,
        type: 2,
    })

const moveDownBtn = (id: string) =>
    new ButtonBuilder({
        custom_id: `BLACKJACK_MOVE_DOWN;${id}`,
        style: ButtonStyle.Secondary,
        label: `Flytt ned`,
        disabled: false,
        type: 2,
    })
