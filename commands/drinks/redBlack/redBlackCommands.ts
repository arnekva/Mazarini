import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    Message,
} from 'discord.js'
import { AbstractCommands } from '../../../Abstracts/AbstractCommand'
import { IInteractionElement } from '../../../general/commands'
import { ButtonHandler } from '../../../handlers/buttonHandler'
import { EmojiHelper } from '../../../helpers/emojiHelper'
import { MessageHelper } from '../../../helpers/messageHelper'
import { ArrayUtils } from '../../../utils/arrayUtils'
import { MentionUtils } from '../../../utils/mentionUtils'
import { RandomUtils } from '../../../utils/randomUtils'
import { CardCommands, ICardObject } from '../../cardCommands'
import { RedBlackButtonHandler } from './redBlackButtonHandler'
import { setupGameButtonRow, redBlackButtonRow, gtButtonRow } from './redBlackButtonRows'
import { IGameRules, BusRide, IUserObject, IGiveTakeCard, GameStage } from './redBlackInterfaces'

const defaultRules: IGameRules = {
    gtLevelSips: [2, 4, 6, 8, Number.POSITIVE_INFINITY],
    busRide: BusRide.Canadian
}

const testData: IUserObject[] = [
    { name: 'PhedeSpelar', id: 0, cards: new Array<ICardObject>() },
    { name: 'Eivind', id: 1, cards: new Array<ICardObject>() },
    { name: 'Deadmaggi', id: 2, cards: new Array<ICardObject>() },
]

export class RedBlackCommands extends AbstractCommands {
    private playerList: IUserObject[]
    private activeGame: boolean
    private initiated: boolean
    private stage: GameStage
    private deck: CardCommands
    private rules: IGameRules
    private currentPlayer
    private gtTable: Map<number, IGiveTakeCard>
    private currentGtCard: IGiveTakeCard
    private gtNextCardId: number
    private id: number
    private turn: number
    private gtTableMessage: Message
    private embedMessage: Message
    private buttonsMessage: Message
    private embed: EmbedBuilder
    private currentButtons: ActionRowBuilder<ButtonBuilder>

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.activeGame = false
        this.initiated = false
        this.stage = undefined
        this.playerList = new Array<IUserObject>()
        this.deck = new CardCommands(client, messageHelper)
        this.rules = defaultRules
        this.gtTable = new Map<number, IGiveTakeCard>()
        this.currentGtCard = undefined
        this.gtNextCardId = 0
        this.id = 0
        this.turn = 0
        this.gtTableMessage = undefined
        this.embedMessage = undefined
        this.buttonsMessage = undefined
        this.embed = undefined
        this.currentButtons = setupGameButtonRow
    }

    public async generateGiveTakeTable(interaction: ButtonInteraction<CacheType>) {
        const levels = this.rules.gtLevelSips.length
        let key = 0
        for (var i = 1; i < levels; i++) 
        {
            for (var y = 1; y <= 3; y++) 
            {

                this.gtTable.set(key++,
                    { card: await this.drawCard(interaction) 
                    , give: y == 1 || y == 3
                    , take: y == 2 || y == 3
                    , sips: this.rules.gtLevelSips[i-1]
                    , revealed: false
                    }
                )
            }
        }
        this.gtTable.set(key, 
                    { card: await this.drawCard(interaction) 
                    , give: false
                    , take: true
                    , sips: this.rules.gtLevelSips[levels-1]
                    , revealed: false
                    }
        )        
    }

    private async drawCard(interaction: ButtonInteraction<CacheType>) {
        if (this.deck.getRemainingCards() > 0) {
            return await this.deck.drawCard(interaction)
        }
        this.deck.shuffleDeck()
        return await this.deck.drawCard(interaction)
    }

    public async printGiveTakeTable(interaction: ButtonInteraction<CacheType>) {                
        let tableString = ''
        const levels = this.rules.gtLevelSips.length
        let iterateId = this.gtTable.size - 1
        const chugCard = this.gtTable.get(iterateId--)
        const emptyCard = await (await EmojiHelper.getEmoji('emptyCard', interaction)).id
        const faceCard = await (await EmojiHelper.getEmoji('faceCard', interaction)).id
        tableString += `${emptyCard} ${chugCard.revealed ? chugCard.card.printString : faceCard}`
        
        for (var i = levels-1; i > 0; i--) 
        {
            tableString += '\n\n'
            const gtCard = this.gtTable.get(iterateId--)
            const tCard = this.gtTable.get(iterateId--)
            const gCard = this.gtTable.get(iterateId--)
            const gtCardStr = gtCard.revealed ? `${gtCard.card.printString} ` : `${faceCard} `
            const tCardStr = tCard.revealed ? `${tCard.card.printString} ` : `${faceCard} `
            const gCardStr = gCard.revealed ? `${gCard.card.printString} ` : `${faceCard} `
            tableString += (gCardStr + tCardStr + gtCardStr)
        }
        if (!this.gtTableMessage) {
            this.gtTableMessage = await this.messageHelper.sendMessage(interaction.channelId, tableString)
        } else {
            this.gtTableMessage.edit(tableString)
        }
        interaction.deferUpdate()
    }

    public revealNextGTCard(interaction: ButtonInteraction<CacheType>) {
        this.currentGtCard = this.gtTable.get(this.gtNextCardId++)
        this.currentGtCard.revealed = true
        //Må resette "A kan gi x slurker" meldinger
        //Må oppdatere embed med nytt kort
        this.printGiveTakeTable(interaction)
    }

    private cardIsValid(userCard: ICardObject) {
        return this.currentGtCard.card.number == userCard.number
    }

    public async placeCard(interaction: ButtonInteraction<CacheType>) {
        const user = this.getUserObject(interaction.user.username)
        const index = user.cards.findIndex(card => this.cardIsValid(card))
        if (index < 0) {
            return await this.messageHelper.replyToInteraction(interaction, 'Du har ingen kort du kan legge på bordet', true)
        }
        const placedCard = user.cards.splice(index, 1).pop()
        this.updateGiveTakeGameMessage(placedCard, user.name)
    }

    private updateGiveTakeGameMessage(card: ICardObject, username: string) {
        //Må 
    }

    private updateRedBlackGameMessage(card: ICardObject, username: string, correct: boolean) {
        //Må 
    }

    public async handleRedBlackGuess(interaction: ButtonInteraction<CacheType>) {
        const user = this.getUserObject(interaction.user.username)
        const card = await this.drawCard(interaction)
        const guess = interaction.customId.split('_').pop()
        let correct = false
        if (interaction.customId.startsWith(RedBlackButtonHandler.GUESS_RB)) {
            correct = (guess == 'Black' && ['S','C'].includes(card.suite)) 
                   || (guess == 'Red' && ['H','D'].includes(card.suite))
        } else if (interaction.customId.startsWith(RedBlackButtonHandler.GUESS_UD)) {
            const card1 = user.cards[0]
            correct = (guess == 'Up' && card.number > card1.number)
                   || (guess == 'Down' && card.number < card1.number)
                   || (guess == 'Same' && card.number == card1.number)
        } else if (interaction.customId.startsWith(RedBlackButtonHandler.GUESS_IO)) {
            const card1 = user.cards[0]
            const card2 = user.cards[1]
            correct = (guess == 'Inside' && card.number > card1.number && card.number < card2.number)
                   || (guess == 'Outside' && card.number < card1.number || card.number > card2.number)
                   || (guess == 'Same' && card.number == card1.number || card.number == card2.number)
        } else if (interaction.customId.startsWith(RedBlackButtonHandler.GUESS_S)) {
            correct = guess == card.suite
        }
        user.cards.push(card)
        user.cards.sort((a,b) => a.number - b.number)
        this.updateRedBlackGameMessage(card, user.name, correct)
    }

    private verifyUsersTurn(username: string) {

    }

    private setCardOnUser(username: string, card: string) {
        let userObject = this.getUserObject(username)
        let cardObject = undefined//this.createCardObject(card)
        userObject.cards.push(cardObject)
        this.playerList[this.getUserIndex(username)] = userObject
        return cardObject
    }

    private getUserObject(username: string) {
        return this.playerList[this.getUserIndex(username)]
    }

    private getUserIndex(username: string) {
        return this.playerList
            .map(function (e) {
                return e.name
            })
            .indexOf(username)
    }

    private getUserObjectById(id2: number) {
        const index = this.playerList.map((e) => e.id).indexOf(id2)
        return this.playerList[index]
    }

    private cardsMatch(card1: ICardObject, card2: ICardObject) {
        return card1?.number === card2?.number || card1.suite === card2.suite ? true : false
    }

    

    public async olddrawCard(interaction: ButtonInteraction<CacheType>) {
        if (this.playerList.find((player) => player.name == interaction.user.username)) {
            let card: ICardObject = await this.deck.drawCard()
            if (card == undefined) {
                this.messageHelper.replyToInteraction(interaction, 'Kortstokken er tom. Bruk knappen under dersom dere vil fortsette.')
                //this.messageHelper.sendMessageWithComponents(interaction?.channelId, [resetDeckButtonRow])
            } else {
                const currentPlayer = this.getUserObjectById(this.turn)
                this.turn = (this.turn + 1) % this.playerList.length
                //this.setCardOnUser(currentPlayer.name, card)
                //const mustDrink = this.checkWhoMustDrink(currentPlayer.name, currentPlayer.id, currentPlayer.card)
                //this.updateActiveGameMessage(mustDrink, currentPlayer)
                this.replyToInteraction(interaction)
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, `Du må være med for å kunne trekke`, true)
        }
    }

    private updateActiveGameMessage(mustDrink: Array<IUserObject>, currentPlayer: IUserObject) {
        let formattedMsg = new EmbedBuilder().setTitle('Electricity ⚡').setDescription('Kort på bordet:')

        let sips = mustDrink.length
        this.playerList.forEach((player) => {
            let playerName = player.id == currentPlayer?.id ? MentionUtils.mentionUser(player.id.toString()) : player.name
            playerName += mustDrink.length > 1 && mustDrink.includes(player) ? ' 🍷x' + sips : ''
            formattedMsg.addFields({
                name: playerName,
                value: player.cards[0].printString + ' ',
                inline: false,
            })
        })
        this.embed = formattedMsg
    }

    private async replyToInteraction(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (interaction.isButton()) {
            this.embedMessage.edit({ embeds: [this.embed], components: [this.currentButtons] })
            interaction.deferUpdate()
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Nu skal det drekjast')
            this.embedMessage = await this.messageHelper.sendFormattedMessage(interaction?.channelId, this.embed)
            this.buttonsMessage = await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [this.currentButtons])
        }
    }

    public setupRedBlack(interaction: ChatInputCommandInteraction<CacheType>) {
        if (this.activeGame || this.initiated) {
            this.messageHelper.replyToInteraction(interaction, 'Du kan bare ha ett aktivt spill om gangen. For å avslutte spillet, bruk "/electricity stopp"')
        } else {
            this.currentButtons = setupGameButtonRow
            this.initiated = true
            this.stage = GameStage.RedBlack
            this.updateStartMessage()
            this.replyToInteraction(interaction)
        }
    }

    public async joinGame(interaction: ButtonInteraction<CacheType>) {
        const newUser = interaction.user
        if (!this.playerList.find((player) => player.name == newUser.username)) {
            const user: IUserObject = { name: newUser.username, id: this.id, cards: new Array<ICardObject>() }
            this.playerList.push(user)
            this.id++
            this.updateStartMessage()
            this.replyToInteraction(interaction)
        } else {
            interaction.deferUpdate()
        }
    }

    public startGame(interaction: ButtonInteraction<CacheType>) {
        if (this.playerList.length < 1) {
            this.messageHelper.replyToInteraction(
                interaction,
                'Det trengs minst 1 deltaker for å starte spillet (men det er litt trist å spille dette alene).',
                false
            )
        } else {
            this.activeGame = true
            //this.currentButtons = activeGameButtonRow
            this.updateActiveGameMessage([], null)
            this.replyToInteraction(interaction)
            this.buttonsMessage.edit({ components: [this.currentButtons] })
        }
    }

    private updateStartMessage() {
        let formattedMsg = new EmbedBuilder().setTitle('Rød eller Svart :thinking:').setDescription('Følgende spelare er klare for å drikke litt (masse):')
        this.playerList.forEach((player) => {
            formattedMsg.addFields({
                name: player.name,
                value: ' ',
                inline: false,
            })
        })
        this.embed = formattedMsg
    }

    public async resendMessages(interaction: ButtonInteraction<CacheType>) {
        this.deleteMessages()
        this.embedMessage = await this.messageHelper.sendFormattedMessage(interaction?.channelId, this.embed)
        this.buttonsMessage = await this.messageHelper.sendMessageWithComponents(interaction?.channelId, [this.currentButtons])
    }

    private deleteMessages() {
        this.embedMessage.delete()
        this.buttonsMessage.delete()
        this.embedMessage = undefined
        this.buttonsMessage = undefined
    }

    public async resetDeck(interaction: ButtonInteraction<CacheType>) {
        const msg = this.deck.resetDeck()
        this.messageHelper.replyToInteraction(interaction, msg)
    }

    private stopRedBlack(interaction: ChatInputCommandInteraction<CacheType>) {
        this.playerList = new Array<IUserObject>()
        this.deck.resetDeck()
        this.id = 0
        this.activeGame = false
        this.initiated = false
        this.messageHelper.replyToInteraction(interaction, 'Spillet er stoppet og kortstokken nullstilt', false)
    }

    public checkUserIsActivePlayer(username: string) {
        return this.playerList.some(user => user.name == username)
    }

    private rbSwitch(interaction: ChatInputCommandInteraction<CacheType>) {
        const action = interaction.options.getSubcommand()
        if (action) {
            switch (action.toLowerCase()) {
                case 'start': {
                    this.setupRedBlack(interaction)
                    break
                }
                case 'stopp': {
                    if (!this.activeGame && !this.initiated) {
                        this.messageHelper.replyToInteraction(interaction, 'Det er ingenting å stoppe')
                    } else {
                        this.stopRedBlack(interaction)
                    }
                    break
                }
                case 'instillinger': {
                    const options = this.setElectricityOptions(interaction)
                    this.messageHelper.replyToInteraction(interaction, options)
                    break
                }
                default: {
                    this.messageHelper.replyToInteraction(interaction, "Tilgjengelige kommandoer er: 'start', 'stopp' og 'instillinger'")
                }
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, "Du må inkludere en av følgende etter '/electricity': 'start', 'stopp', eller 'instillinger'")
        }
    }

    private setElectricityOptions(interaction: ChatInputCommandInteraction<CacheType>): string {
        const mate = interaction.options.get('mate')?.user
        const chugOnLoop = interaction.options.get('chug-on-loop')?.value as boolean | undefined
        const addPlayer = interaction.options.get('add')?.user
        let reply = ``
        if (addPlayer) {
            // const mockCard: ICardObject = { number: '', suite: '', printString: '', url: '' }
            const user: IUserObject = { name: addPlayer.username, id: this.id++, cards: new Array<ICardObject>() }
            this.playerList.push(user)
            reply += `\nLa til ${user.name} i spillet på plass ${user.id}`
        }
        return reply
    }

    getAllInteractions(): IInteractionElement[] {
        return [
            {
                commandName: 'redblack',
                command: (interaction: ChatInputCommandInteraction<CacheType>) => {
                    this.rbSwitch(interaction)
                },
            },
        ]
    }
}
