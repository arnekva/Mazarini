import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, CacheType, EmbedBuilder, Message } from 'discord.js'
import { EmojiHelper } from '../../../../helpers/emojiHelper'
import { MessageHelper } from '../../../../helpers/messageHelper'
import { CardCommands } from '../../../games/cardCommands'
import { TryAgainBtn, canadianBusrideButtonRow } from '../redBlackButtonRows'
import { IBusRideCard, IUserObject } from '../redBlackInterfaces'

export class BusRide {
    private deck: CardCommands
    private cardsOnTable: Array<IBusRideCard>
    private nextCardId: number
    private embedMessage: Message
    private embed: EmbedBuilder
    private tableMessage: Message
    private tableString: string
    private loser: IUserObject
    private messageHelper: MessageHelper
    private currentButtons: ActionRowBuilder<ButtonBuilder>
    private totalSips: number

    constructor(messageHelper: MessageHelper, deck: CardCommands, embedMessage: Message, tableMessage: Message, loser: IUserObject) {
        this.messageHelper = messageHelper
        this.deck = deck
        this.cardsOnTable = undefined
        this.nextCardId = 1
        this.embedMessage = embedMessage
        this.embed = undefined
        this.tableMessage = tableMessage
        this.tableString = undefined
        this.loser = loser
        this.currentButtons = canadianBusrideButtonRow
        this.totalSips = 0
    }

    public async setupCanadianBusride(interaction: ButtonInteraction<CacheType>) {
        this.cardsOnTable = new Array<IBusRideCard>()
        const startCard = { card: await this.drawCard(interaction), revealed: true }
        this.cardsOnTable[0] = startCard
        await this.setNewCards(6, interaction)
        this.embed = new EmbedBuilder().setTitle('Busstur').setDescription(`Kos deg på tur, ${this.loser.name}!`)
        this.embedMessage.edit({ embeds: [this.embed], components: [] })
        this.printCanadianBusrideTable(interaction)
    }

    private async printCanadianBusrideTable(interaction: ButtonInteraction<CacheType>, correct: boolean = true) {
        let cardsString = ''
        const faceCard = (await EmojiHelper.getEmoji('faceCard', interaction)).id
        for (var i = 0; i < 7; i++) {
            cardsString += this.cardsOnTable[i].revealed ? `${this.cardsOnTable[i].card.printString} ` : `${faceCard} `
        }
        this.tableString = cardsString
        this.currentButtons = correct ? canadianBusrideButtonRow : TryAgainBtn
        this.tableMessage.edit({ content: this.tableString, components: [this.currentButtons] })
    }

    private async updateBusrideMessage(interaction: ButtonInteraction<CacheType>, correct: boolean) {
        const guess = this.guessTranslations.get(interaction.customId.split(';')[1])
        let text = ''
        if (!correct) {
            this.totalSips += this.nextCardId
            text = 'Ble jo fort feil det! Drikk ' + this.nextCardId + ' og prøv igjen 🍷'
        } else {
            if (this.nextCardId === this.cardsOnTable.length - 1) {
                text = 'Jaja gz då'
            } else {
                text = 'Det var dessverre riktig'
            }
        }
        this.embed.setDescription(`${this.loser.name} gjettet: ${guess}\n\n ${text}`)
        this.embedMessage.edit({ embeds: [this.embed] })
    }

    private async setNewCards(i: number, interaction: ButtonInteraction<CacheType>) {
        for (var y = 1; y <= i; y++) {
            let card = { card: await this.drawCard(interaction), revealed: false }
            this.cardsOnTable[y] = card
        }
    }

    private async drawCard(interaction: ButtonInteraction<CacheType>) {
        if (this.deck.getRemainingCards() > 0) {
            return await this.deck.drawCard(interaction)
        }
        this.deck.shuffleDeck()
        return await this.deck.drawCard(interaction)
    }

    public async guessCanadian(interaction: ButtonInteraction<CacheType>) {
        if (!this.verifyUsersTurn(interaction.user.username)) {
            return this.messageHelper.replyToInteraction(interaction, 'Nå er det heldigvis ikke du som tar bussturen', { hasBeenDefered: true })
        }
        let currentCard = this.cardsOnTable[this.nextCardId - 1]
        let nextCard = this.cardsOnTable[this.nextCardId]
        nextCard.revealed = true
        const guess = interaction.customId.split(';')[1]
        let correct = false
        if (guess === 'up') correct = nextCard.card.number > currentCard.card.number
        if (guess === 'down') correct = nextCard.card.number < currentCard.card.number
        if (guess === 'same') correct = nextCard.card.number === currentCard.card.number

        this.updateBusrideMessage(interaction, correct)
        this.printCanadianBusrideTable(interaction, correct)
        if (correct) {
            if (this.nextCardId < this.cardsOnTable.length - 1) {
                this.nextCardId++
            } else {
                this.tableMessage.edit({ content: this.tableString, components: [] })
            }
        }

        interaction.deferUpdate()
    }

    private verifyUsersTurn(username: string) {
        return username === this.loser.name
    }

    public async resetCanadian(interaction: ButtonInteraction<CacheType>) {
        await this.setNewCards(this.nextCardId, interaction)
        this.nextCardId = 1
        this.embed.setDescription(this.tryAgainInsults[Math.floor(Math.random() * 5)])
        this.embedMessage.edit({ embeds: [this.embed] })
        this.printCanadianBusrideTable(interaction)
        interaction.deferUpdate()
    }

    public async resendMessages(interaction: ButtonInteraction<CacheType>) {
        this.deleteMessages()
        this.embedMessage = await this.messageHelper.sendMessage(interaction?.channelId, { embed: this.embed })
        this.tableMessage = await this.messageHelper.sendMessage(interaction.channelId, { text: this.tableString, components: [this.currentButtons] })
    }

    private deleteMessages() {
        this.embedMessage.delete()
        this.embedMessage = undefined
        this.tableMessage.delete()
        this.tableMessage = undefined
    }

    private guessTranslations: Map<string, string> = new Map<string, string>([
        ['up', 'opp'],
        ['down', 'ned'],
        ['same', 'likt'],
    ])

    private tryAgainInsults: Array<string> = [
        'Da prøver vi igjen.',
        'Jaja, lykke til da!\n\nneida',
        'Jeg har troen',
        'Håper du kommer til siste kortet før du ryker',
        'lol',
    ]
}
