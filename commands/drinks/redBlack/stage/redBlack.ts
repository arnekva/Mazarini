import { ICardObject } from "../../../cardCommands"
import { RedBlackButtonHandler } from "../redBlackButtonHandler"

export class RedBlack {

    public static async guessRB(card: ICardObject, customId: string) {
        const guess = customId.replace(RedBlackButtonHandler.GUESS_RED_BLACK, '')
        return guess === 'red' ? ['H','D'].includes(card.suite) : ['S','C'].includes(card.suite)
    }

    public static async guessUD(card: ICardObject, prevCards: ICardObject[], customId: string) {
        const guess = customId.replace(RedBlackButtonHandler.GUESS_UP_DOWN, '')
        const prevCard = prevCards.pop()
        if (guess === 'up') return card.number > prevCard.number
        if (guess === 'down') return card.number < prevCard.number
        return card.number == prevCard.number
    }

    public static async guessIO(card: ICardObject, prevCards: ICardObject[], customId: string) {
        const guess = customId.replace(RedBlackButtonHandler.GUESS_IN_OUT, '')
        const highCard = prevCards.pop()
        const lowCard = prevCards.pop()
        if (guess === 'in') return card.number > lowCard.number && card.number < highCard.number
        if (guess === 'out') return card.number < lowCard.number || card.number > highCard.number
        return card.number == highCard.number || card.number == lowCard.number
    }

    public static async guessSuit(card: ICardObject, customId: string) {
        const guess = customId.replace(RedBlackButtonHandler.GUESS_SUIT, '')
        return guess === card.suite
    }
}