import {
    ActionRowBuilder,
    APIEmbedField,
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
import { setupGameButtonRow, redBlackButtonRow, gtButtonRow, upDownButtonRow, insideOutsideButtonRow, suitButtonRow, nextPhaseBtn, gtStartButtonRow } from './redBlackButtonRows'
import { IGameRules, BusRide, IUserObject, IGiveTakeCard, GameStage, RedBlackRound } from './redBlackInterfaces'
import { GiveTake } from './stage/giveTake'
import { RedBlack } from './stage/redBlack'

const defaultRules: IGameRules = {
    gtLevelSips: [2, 4, 6, 8, Number.POSITIVE_INFINITY],
    busRide: BusRide.Canadian
}

const testData: IUserObject[] = [ //legge til en ephemeral message på hver user? :thinking:
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
    private currentPlayer: IUserObject
    private currentGtCard: IGiveTakeCard
    private id: number
    private rbRound: RedBlackRound
    private rbSips: number
    private gtTableMessage: Message
    private embedMessage: Message
    private buttonsMessage: Message
    private embed: EmbedBuilder
    private currentButtons: ActionRowBuilder<ButtonBuilder>
    private giveTake: GiveTake

    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.activeGame = false
        this.initiated = false
        this.stage = undefined
        this.playerList = new Array<IUserObject>()
        this.deck = new CardCommands(client, messageHelper)
        this.rules = defaultRules
        this.currentGtCard = undefined
        this.id = 0
        this.rbRound = undefined
        this.rbSips = 1
        this.gtTableMessage = undefined
        this.embedMessage = undefined
        this.buttonsMessage = undefined
        this.embed = undefined
        this.currentButtons = setupGameButtonRow
        this.giveTake = undefined
    }

    private async drawCard(interaction: ButtonInteraction<CacheType>) {
        if (this.deck.getRemainingCards() > 0) {
            return await this.deck.drawCard(interaction)
        }
        this.deck.shuffleDeck()
        return await this.deck.drawCard(interaction)
    }

    public isEndOfRound() {
        return this.playerList.every(player => player.cards.length === this.playerList[0].cards.length)
    }

    private handleRoundChange() {
        if (this.rbRound === RedBlackRound.RedBlack) {
            this.rbRound = RedBlackRound.UpDown
            this.rbSips = 2
            this.currentButtons = upDownButtonRow
        } else if (this.rbRound === RedBlackRound.UpDown) {
            this.rbRound = RedBlackRound.InsideOutside
            this.rbSips = 3
            this.currentButtons = insideOutsideButtonRow
        } else if (this.rbRound === RedBlackRound.InsideOutside) {
            this.rbRound = RedBlackRound.Suit
            this.rbSips = 4
            this.currentButtons = suitButtonRow
        } else {
            this.rbRound = RedBlackRound.Finished
            this.currentButtons = nextPhaseBtn
        }
    }

    // Kalles når man trykker på "neste fase" knappen
    public async phaseController(interaction: ButtonInteraction<CacheType>) {
        if (this.stage === GameStage.RedBlack) {
            this.stage = GameStage.GiveTake
            this.giveTake = new GiveTake(this.deck, this.rules)
            await this.giveTake.generateGiveTakeTable(interaction)
            this.currentButtons = gtStartButtonRow
            const tableString = await this.giveTake.printGiveTakeTable(interaction)
            this.gtTableMessage = await this.messageHelper.sendMessageWithContentAndComponents(interaction.channelId, tableString, [this.currentButtons])
            this.currentButtons = gtButtonRow
        }
    }

    //Må ha en egen metode for å holde oversikt over hvem sin tur det er og hvor langt man har kommet i runden. Egen for hver av delene til spillet?

    public async guess(interaction: ButtonInteraction<CacheType>) {
        if (!this.verifyUsersTurn(interaction.user.username)) {
            return this.messageHelper.replyToInteraction(interaction, 'Det er ikke din tur', true)
        }
        const card = await this.drawCard(interaction)
        const prevCards = this.getCardsOnUser(interaction.user.username)
        let correct = false
        if (interaction.customId === RedBlackButtonHandler.GUESS_RED_BLACK) 
        { 
            correct = await RedBlack.guessRB(card, interaction.customId)
        }
        else if (interaction.customId === RedBlackButtonHandler.GUESS_UP_DOWN) 
        { 
            correct = await RedBlack.guessUD(card, prevCards, interaction.customId) 
        }
        else if (interaction.customId === RedBlackButtonHandler.GUESS_IN_OUT) 
        { 
            correct = await RedBlack.guessIO(card, prevCards, interaction.customId) 
        }
        else if (interaction.customId === RedBlackButtonHandler.GUESS_SUIT) 
        { 
            correct = await RedBlack.guessSuit(card, interaction.customId) 
        }
        this.setCardOnUser(interaction.user.username, card)
        //TODO: replyToInteraction with "you can (give/take) x sips"
        this.currentPlayer = this.playerList.find(player => player.id === ((this.currentPlayer.id + 1) % this.playerList.length))
        if (this.isEndOfRound()) this.handleRoundChange()
        this.updateRedBlackGameMessage(card, interaction, correct)
    }

    public async nextGtCard(interaction: ButtonInteraction<CacheType>) {
        this.currentGtCard = this.giveTake.revealNextGTCard(interaction)
        const tableString = await this.giveTake.printGiveTakeTable(interaction)
        this.gtTableMessage.edit({ content: tableString, components: [this.currentButtons] })
        interaction.deferUpdate()
    }

    public async placeGtCard(interaction: ButtonInteraction<CacheType>) {
        const user = this.getUserObject(interaction.user.username)
        const index = user.cards.findIndex(card => this.cardIsValid(card))
        if (index < 0) {
            return await this.messageHelper.replyToInteraction(interaction, 'Du har ingen kort du kan legge på bordet', true)
        }
        const placedCard = user.cards.splice(index, 1).pop()
        this.updateGiveTakeGameMessage(placedCard, user.name)
    }

    private getCardsOnUser(username: string) {
        return this.getUserObject(username).cards.sort((x,y) => x.number-y.number)
    }

    private cardIsValid(userCard: ICardObject) {
        return this.currentGtCard.card.number == userCard.number
    }

    private updateGiveTakeGameMessage(card: ICardObject, username: string) {
        //Må 
    }

    private updateRedBlackGameMessage(drawnCard: ICardObject, interaction: ButtonInteraction<CacheType>, correct: boolean) {
        const formattedMsg = new EmbedBuilder().setTitle('Rød eller Svart')
        if (drawnCard) {
            formattedMsg.setDescription(`${interaction.user.username} gjettet ${RedBlack.getTranslatedGuessValue(interaction.customId, this.rbRound)}`
                                    + `\n\n${correct ? 'Gi' : 'Drikk'} ${this.rbSips} 🍷\n\n--------------------------------------`)
        }
       
        formattedMsg.addFields({ name: `${this.currentPlayer.name} sin tur`, value: `${this.currentPlayer.cards.length >= 1 ? 'Kort:' : ' '}` })
        this.currentPlayer.cards.forEach((card) => {
            formattedMsg.addFields({
                name: this.deck.getStringPrint(card),
                value: card.printString,
                inline: true,
            })
        })
        this.embed = formattedMsg
        this.embedMessage.edit({ embeds: [this.embed], components: [this.currentButtons] })
    }

    private verifyUsersTurn(username: string) {
        return username === this.currentPlayer.name
    }

    private setCardOnUser(username: string, card: ICardObject) {
        this.getUserObject(username).cards.push(card)
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

    private async updateEmbedMessage(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (interaction.isButton()) {
            this.embedMessage.edit({ embeds: [this.embed], components: [this.currentButtons] })
            interaction.deferUpdate()
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Nu skal det drekjast')
            this.embedMessage = await this.messageHelper.sendMessageWithEmbedAndButtons(interaction?.channelId, this.embed, [this.currentButtons])
        }
    }

    public async setupRedBlack(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (this.activeGame || this.initiated) {
            this.messageHelper.replyToInteraction(interaction, 'Du kan bare ha ett aktivt spill om gangen. For å avslutte spillet, bruk "/electricity stopp"')
        } else {
            this.initiated = true
            this.stage = GameStage.RedBlack
            this.rbRound = RedBlackRound.RedBlack
            this.updateStartMessage()
            // this.updateEmbedMessage(interaction)
            this.messageHelper.replyToInteraction(interaction, 'Nu skal det drekjast')
            this.embedMessage = await this.messageHelper.sendMessageWithEmbedAndButtons(interaction?.channelId, this.embed, [this.currentButtons])
        }
    }

    public async joinGame(interaction: ButtonInteraction<CacheType>) {
        const newUser = interaction.user
        if (!this.playerList.find((player) => player.name == newUser.username)) {
            const user: IUserObject = { name: newUser.username, id: this.id, cards: new Array<ICardObject>() }
            this.playerList.push(user)
            this.id++
            this.updateStartMessage()
            this.updateEmbedMessage(interaction)
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
            this.currentButtons = redBlackButtonRow
            this.currentPlayer = this.playerList[0]
            this.updateRedBlackGameMessage(null, undefined, undefined)
            // this.updateEmbedMessage(interaction)
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
