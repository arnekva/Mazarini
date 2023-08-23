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
    Message
} from 'discord.js'
import { AbstractCommands } from '../../../Abstracts/AbstractCommand'
import { IButtonInteractionElement, IInteractionElement, IModalInteractionElement, ISelectMenuInteractionElement } from '../../../general/commands'
import { MessageHelper } from '../../../helpers/messageHelper'
import { CardCommands, ICardObject } from '../../cardCommands'
import {
    gtButtonRow,
    gtStartButtonRow,
    insideOutsideButtonRow,
    moveBtn,
    nextPhaseBtn,
    redBlackButtonRow,
    revealLoserBtn,
    setupGameButtonRow,
    suitButtonRow,
    upDownButtonRow
} from './redBlackButtonRows'
import { GameStage, IBusRide, IGameRules, IGiveTakeCard, IUserObject, RedBlackRound } from './redBlackInterfaces'
import { BusRide } from './stage/busRide'
import { GiveTake } from './stage/giveTake'
import { RedBlack } from './stage/redBlack'

const defaultRules: IGameRules = {
    gtLevelSips: [2, 4, 6, 8, Number.POSITIVE_INFINITY],
    busRide: IBusRide.Canadian,
}

const testData: IUserObject[] = [
    //legge til en ephemeral message på hver user? :thinking:
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
    private gtTableMessage: Message //TODO: Burde kanskje refactor-e til embedMessage (brukes i rød-svart, gi-ta, buss) og tableMessage (rød-svart: kortene til den sin tur det er, gi-ta: kortene på bordet, buss: kortene på bordet)
    private gtTableString: string
    private playerCardsMessage: Message
    private putDownCardsThisRound: string[]
    private embedMessage: Message
    private embed: EmbedBuilder
    private currentButtons: ActionRowBuilder<ButtonBuilder>
    private giveTake: GiveTake
    private busride: BusRide
    public static aceValue: 1 | 14 | undefined = undefined
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
        this.initGame()
    }

    private initGame() {
        this.activeGame = false
        this.initiated = false
        this.stage = undefined
        this.playerList = new Array<IUserObject>()
        this.deck = new CardCommands(this.client, this.messageHelper)
        this.rules = defaultRules
        this.currentGtCard = undefined
        this.id = 0
        this.rbRound = undefined
        this.rbSips = 1
        this.gtTableMessage = undefined
        this.gtTableString = undefined
        this.playerCardsMessage = undefined
        this.putDownCardsThisRound = new Array<string>()
        this.embedMessage = undefined
        this.embed = undefined
        this.currentButtons = setupGameButtonRow
        this.giveTake = undefined
        this.busride = undefined
    }

    private async drawCard(interaction: ButtonInteraction<CacheType>) {
        if (this.deck.getRemainingCards() > 0) {
            return await this.deck.drawCard(interaction)
        }
        this.deck.shuffleDeck()
        return await this.deck.drawCard(interaction)
    }

    public isEndOfRound() {
        return this.playerList.every((player) => player.cards.length === this.playerList[0].cards.length)
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
            this.gtTableString = await this.giveTake.printGiveTakeTable(interaction)
            await this.resendMessages(interaction)
            // this.gtTableMessage = await this.messageHelper.sendMessageWithContentAndComponents(interaction.channelId, this.gtTableString, [this.currentButtons])
            this.currentButtons = gtButtonRow
            interaction.deferUpdate()
        } else if (this.stage === GameStage.GiveTake) {
            // Do stuff
        }
    }

    //Må ha en egen metode for å holde oversikt over hvem sin tur det er og hvor langt man har kommet i runden. Egen for hver av delene til spillet?

    public async guess(interaction: ButtonInteraction<CacheType>) {
        if (!this.verifyUsersTurn(interaction.user.username)) {
            return this.messageHelper.replyToInteraction(interaction, 'Det er ikke din tur', true)
        }
        const card = await this.drawCard(interaction)
        const prevCards = this.getCardsOnUser(interaction.user.username)
        const copy = prevCards.map((card) => ({ ...card }))

        let correct = false
        const stage = interaction.customId.split(';')[1]
        const guess = interaction.customId.split(';')[2]
        if (stage === 'RB') {
            correct = await RedBlack.guessRB(card, guess)
        } else if (stage === 'UD') {
            correct = await RedBlack.guessUD(card, copy, guess)
        } else if (stage === 'IO') {
            correct = await RedBlack.guessIO(card, copy, guess)
        } else if (stage === 'SUIT') {
            correct = await RedBlack.guessSuit(card, guess)
        }
        this.setCardOnUser(interaction.user.username, card)
        this.currentPlayer = this.playerList.find((player) => player.id === (this.currentPlayer.id + 1) % this.playerList.length)
        this.updateRedBlackGameMessage(card, interaction, correct)
        interaction.deferUpdate()
    }

    public async nextGtCard(interaction: ButtonInteraction<CacheType>) {
        this.putDownCardsThisRound = new Array<string>()
        this.currentGtCard = this.giveTake.revealNextGTCard(interaction)
        if (this.currentGtCard.sips === Number.POSITIVE_INFINITY) this.currentButtons = revealLoserBtn
        this.gtTableString = await this.giveTake.printGiveTakeTable(interaction)

        //It is first updated with a disabled "Next card" button - then, after 5 seconds it is updated again with it enabled
        //This is to prevent spam-clicking next before anyone can add their card
        const updateMessage = () => {
            this.gtTableMessage.edit({ content: this.gtTableString, components: [this.currentButtons] })
            this.updateGiveTakeGameMessage(undefined, '')
        }
        this.currentButtons.components[1].setDisabled(true)
        updateMessage()
        setTimeout(() => {
            this.currentButtons.components[1].setDisabled(false)
            updateMessage()
        }, 5000)
        interaction.deferUpdate()
    }

    public async placeGtCard(interaction: ButtonInteraction<CacheType>) {
        const user = this.getUserObject(interaction.user.username)
        const index = user.cards.findIndex((card) => this.cardIsValid(card))
        if (index < 0) {
            return await this.messageHelper.replyToInteraction(interaction, 'Du kan ikke legge kort', true)
        }
        const placedCard = user.cards.splice(index, 1).pop()
        this.updateGiveTakeGameMessage(placedCard, user.name)
        interaction.deferUpdate()
    }

    public async sendUserCards(interaction: ButtonInteraction<CacheType>) {
        const user = this.getUserObject(interaction.user.username)
        let cardsString = this.getCardsOnHandForUser(user)
        if (!cardsString.trim()) cardsString = 'Du har ingen kort på hånd'
        return await this.messageHelper.replyToInteraction(interaction, cardsString, true)
    }

    public async revealLoser(interaction: ButtonInteraction<CacheType>) {
        this.gtTableMessage.edit({ content: '** **', components: [] })
        const losers: Array<IUserObject> = this.calculateLoser()
        this.embed.setTitle('Taperen er...').setThumbnail(undefined)
        if (losers.length > 1) {
            this.embed.setDescription(
                'Har du sett.. Vi har faktisk flere tapere her!\n\n' +
                    'Da gjør vi det som enkelt som dette:\n\n\n' +
                    'Første mann som trykker velger hvem som tar bussturen!'
            )
            const tieBreak = new ActionRowBuilder<ButtonBuilder>()
            losers.forEach((loser) => {
                tieBreak.addComponents(
                    new ButtonBuilder({
                        custom_id: `RB_TIE_BREAK;${loser.id}`,
                        style: ButtonStyle.Primary,
                        label: `${loser.name}`,
                        disabled: false,
                        type: 2,
                    })
                )
            })
            tieBreak.addComponents(moveBtn)
            this.embedMessage.edit({ embeds: [this.embed], components: [tieBreak] })
        } else {
            this.showGiveTakeSummary(interaction, losers[0])
        }
        interaction.deferUpdate()
    }

    public async showGiveTakeSummary(interaction: ButtonInteraction<CacheType>, loser: IUserObject = undefined) {
        if (!loser) {
            const id = Number(interaction.customId.split(';')[1])
            loser = await this.getUserObjectById(id)
        }
        this.embed.setDescription(`${loser.name}!`)
        const startBusride = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder({
                custom_id: `RB_START_BUS;${loser.id}`,
                style: ButtonStyle.Primary,
                label: `🚌 Busstur 🚌`,
                disabled: false,
                type: 2,
            }),
            moveBtn
        )
        this.embedMessage.edit({ embeds: [this.embed], components: [startBusride] })
    }

    private calculateLoser() {
        let losers = new Array<IUserObject>()
        let loser = this.playerList[0]
        for (var i = 1; i < this.playerList.length; i++) {
            const potentialLoser = this.playerList[i]
            if (potentialLoser.cards.length > loser.cards.length) {
                loser = potentialLoser
                losers = new Array<IUserObject>()
            }
            if (potentialLoser.cards.length === loser.cards.length) {
                const loserSum = loser.cards.map((a) => a.number).reduce((a, b) => a + b, 0)
                const potentialLoserSum = potentialLoser.cards.map((a) => a.number).reduce((a, b) => a + b, 0)
                if (potentialLoserSum > loserSum) {
                    loser = potentialLoser
                    losers = new Array<IUserObject>()
                }
                if (potentialLoserSum === loserSum) {
                    losers[0] = loser
                    losers[1] = potentialLoser
                }
            }
        }
        if (losers.length > 1) return losers
        else return new Array<IUserObject>(loser)
    }

    public async setupBusride(interaction: ButtonInteraction<CacheType>) {
        const newDeck = new CardCommands(this.client, this.messageHelper)
        const id = Number(interaction.customId.split(';')[1])
        const loser = await this.getUserObjectById(id)
        this.busride = new BusRide(this.messageHelper, newDeck, this.embedMessage, this.gtTableMessage, loser)
        this.busride.setupCanadianBusride(interaction)
    }

    public async busrideGuess(interaction: ButtonInteraction<CacheType>) {
        this.busride.guessCanadian(interaction)
    }

    public async busrideReset(interaction: ButtonInteraction<CacheType>) {
        this.busride.resetCanadian(interaction)
    }

    public async moveBus(interaction: ButtonInteraction<CacheType>) {
        this.busride.resendMessages(interaction)
    }

    private getCardsOnUser(username: string) {
        return this.getUserObject(username).cards.sort((x, y) => x.number - y.number)
    }

    private cardIsValid(userCard: ICardObject) {
        return this.currentGtCard.card.number == userCard.number
    }

    private updateGiveTakeGameMessage(card: ICardObject, username: string) {
        let combinedString = ''
        if (card) {
            this.putDownCardsThisRound.push(
                `${username} la ned ${this.deck.getTranslation(card.suit)} ${CardCommands.transformNumber(card.number)} ${this.deck.getTranslation(card.suit)}`
            )
        }
        this.putDownCardsThisRound.forEach((card) => {
            combinedString += `${card} \n`
        })

        const formattedMsg = new EmbedBuilder()
            .setTitle('Gi eller Ta')
            .setThumbnail(this.currentGtCard.card.url)
            .setDescription(`${this.generateGiveTakeCardString()}:` + `\n\n${combinedString}`)

        this.embed = formattedMsg
        this.embedMessage.edit({ embeds: [this.embed], components: null })
    }

    private generateGiveTakeCardString() {
        const cc = this.currentGtCard
        if (cc.sips === Number.POSITIVE_INFINITY) return 'CHUUUUUUUUG'
        return `Følgende ${cc.take ? 'må' : 'kan'}${cc.give ? ' gi' : ''}${cc.give && cc.take ? ' og' : ''}${cc.take ? ' ta' : ''} ${cc.sips} slurk${
            cc.sips > 1 ? 'er' : ''
        }`
    }

    private async updateRedBlackGameMessage(drawnCard: ICardObject, interaction: ButtonInteraction<CacheType>, correct: boolean) {
        let roundName = RedBlack.getPrettyRoundName(this.rbRound)
        const formattedMsg = new EmbedBuilder().setTitle(`${roundName} - ${this.rbSips} slurk${this.rbSips > 1 ? 'er' : ''}`)
        if (drawnCard) {
            formattedMsg
                .setThumbnail(drawnCard.url)
                .setDescription(
                    `${interaction.user.username} gjettet: ${RedBlack.getTranslatedGuessValue(interaction.customId.split(';')[2])} og fikk kortet til høyre` +
                        `\n🍷 ${correct ? 'Gi' : 'Drikk'} ${this.rbSips} slurk${this.rbSips > 1 ? 'er' : ''} 🍷\n\n\n`
                )
            if (this.isEndOfRound()) {
                this.handleRoundChange()
                roundName = RedBlack.getPrettyRoundName(this.rbRound)
                formattedMsg.setTitle(`${roundName} - ${this.rbSips} slurk${this.rbSips > 1 ? 'er' : ''}`)
            }
        }
        if (this.rbRound === RedBlackRound.Finished) {
            this.playerCardsMessage.delete()
            this.playerCardsMessage = undefined
        } else {
            const fields = [] as APIEmbedField[]
            if (this.currentPlayer.cards.length >= 1) fields.push({ name: ' ', value: ' ' }, { name: ' ', value: ' ' }, { name: ' ', value: ' ' })
            fields.push({
                name: `**${this.currentPlayer.name} sin tur.**`,
                value: `${this.currentPlayer.cards.length >= 1 ? '\n(se kort på hånd under knappene)' : ' '}`,
            })
            formattedMsg.addFields(...fields)
            if (this.currentPlayer.cards.length >= 1) {
                const cardsString = this.getCardsOnHandForUser(this.currentPlayer)
                if (this.playerCardsMessage === undefined) {
                    this.playerCardsMessage = await this.messageHelper.sendMessage(interaction.channelId, cardsString)
                } else {
                    this.playerCardsMessage.edit({ content: cardsString })
                }
            }
        }
        this.embed = formattedMsg
        this.embedMessage.edit({ embeds: [this.embed], components: [this.currentButtons] })
    }

    private getCardsOnHandForUser(user: IUserObject) {
        let printCards: string = ''
        user.cards.forEach((card) => {
            printCards += `${card.printString} `
        })
        return printCards
    }

    private verifyUsersTurn(username: string) {
        return username === this.currentPlayer?.name
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

    private async getUserObjectById(id2: number) {
        const index = this.playerList.map((e) => e.id).indexOf(id2)
        return this.playerList[index]
    }

    private async updateEmbedMessage(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (interaction.isButton()) {
            this.embedMessage.edit({ embeds: [this.embed], components: [this.currentButtons] })
            interaction.deferUpdate()
        } else {
            this.messageHelper.replyToInteraction(interaction, 'Nu skal det drekjast')
            this.embedMessage = await this.messageHelper.sendMessageWithEmbedAndComponents(interaction?.channelId, this.embed, [this.currentButtons])
        }
    }

    public async setupRedBlack(interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType>) {
        if (this.activeGame || this.initiated) {
            this.messageHelper.replyToInteraction(interaction, 'Du kan bare ha ett aktivt spill om gangen. For å avslutte spillet, bruk "/redblack stopp"')
        } else {
            this.initiated = true
            this.stage = GameStage.RedBlack
            this.rbRound = RedBlackRound.RedBlack
            this.updateStartMessage()
            this.messageHelper.replyToInteraction(interaction, 'Nu skal det drekjast')
            this.embedMessage = await this.messageHelper.sendMessageWithEmbedAndComponents(interaction?.channelId, this.embed, [this.currentButtons])
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
            this.updateRedBlackGameMessage(null, interaction, undefined)
            interaction.deferUpdate()
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
        if (this.stage === GameStage.RedBlack) {
            this.embedMessage = await this.messageHelper.sendMessageWithEmbedAndComponents(interaction?.channelId, this.embed, [this.currentButtons])
            if (!(this.rbRound === RedBlackRound.RedBlack)) {
                const cardsString = this.getCardsOnHandForUser(this.currentPlayer)
                this.playerCardsMessage = await this.messageHelper.sendMessage(interaction.channelId, cardsString)
            }
        } else {
            this.embedMessage = await this.messageHelper.sendFormattedMessage(interaction?.channelId, this.embed)
            if (this.stage === GameStage.GiveTake) {
                this.gtTableMessage = await this.messageHelper.sendMessageWithContentAndComponents(interaction.channelId, this.gtTableString, [
                    this.currentButtons,
                ])
            }
        }
        interaction.deferUpdate()
    }

    private deleteMessages() {
        this.embedMessage.delete()
        this.embedMessage = undefined
        if (!(this.playerCardsMessage === undefined)) {
            this.playerCardsMessage.delete()
            this.playerCardsMessage = undefined
        }
        if (!(this.gtTableMessage === undefined)) {
            this.gtTableMessage.delete()
            this.gtTableMessage = undefined
        }
    }

    public async resetDeck(interaction: ButtonInteraction<CacheType>) {
        const msg = this.deck.resetDeck()
        this.messageHelper.replyToInteraction(interaction, msg)
    }

    private stopRedBlack(interaction: ChatInputCommandInteraction<CacheType>) {
        this.initGame()
        this.messageHelper.replyToInteraction(interaction, 'Spillet er stoppet og kortstokken nullstilt', false)
    }

    public checkUserIsActivePlayer(username: string) {
        return this.playerList.some((user) => user.name == username)
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
                    const options = this.setRedBlackOptions(interaction)
                    this.messageHelper.replyToInteraction(interaction, options)
                    break
                }
                default: {
                    this.messageHelper.replyToInteraction(interaction, "Tilgjengelige kommandoer er: 'start', 'stopp' og 'instillinger'")
                }
            }
        } else {
            this.messageHelper.replyToInteraction(interaction, "Du må inkludere en av følgende etter '/redblack': 'start', 'stopp', eller 'instillinger'")
        }
    }

    private setRedBlackOptions(interaction: ChatInputCommandInteraction<CacheType>): string {
        //TODO: implementer
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

    getAllButtonInteractions(): IButtonInteractionElement[] {
        return [
            {
                commandName: 'RB_MOVE',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.resendMessages(rawInteraction)
                },
            },
            {
                commandName: 'RB_MOVE_BUS',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.moveBus(rawInteraction)
                },
            },
            {
                commandName: 'RB_JOIN',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.joinGame(rawInteraction)
                },
            },
            {
                commandName: 'RB_START',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.startGame(rawInteraction)
                },
            },
            {
                commandName: 'RB_GUESS',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.guess(rawInteraction)
                },
            },
            {
                commandName: 'RB_PLACE',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.placeGtCard(rawInteraction)
                },
            },
            {
                commandName: 'RB_NEXT_CARD',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    if (rawInteraction.user.id === '221739293889003520') rawInteraction.deferUpdate()
                    else this.nextGtCard(rawInteraction)
                },
            },
            {
                commandName: 'RB_MY_CARDS',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.sendUserCards(rawInteraction)
                },
            },
            {
                commandName: 'RB_NEXT_PHASE',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.phaseController(rawInteraction)
                },
            },
            {
                commandName: 'RB_BUS_CAN',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.busrideGuess(rawInteraction)
                },
            },
            {
                commandName: 'RB_REVEAL',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.revealLoser(rawInteraction)
                },
            },
            {
                commandName: 'RB_TRY_AGAIN',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.busrideReset(rawInteraction)
                },
            },
            {
                commandName: 'RB_TIE_BREAK',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.showGiveTakeSummary(rawInteraction)
                },
            },
            {
                commandName: 'RB_START_BUS',
                command: (rawInteraction: ButtonInteraction<CacheType>) => {
                    this.setupBusride(rawInteraction)
                },
            },
        ]
    }

    getAllModalInteractions(): IModalInteractionElement[] {
        return []
    }

    getAllSelectMenuInteractions(): ISelectMenuInteractionElement[] {
        return []
    }
}
