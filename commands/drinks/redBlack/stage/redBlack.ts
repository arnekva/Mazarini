import { ICardObject } from "../../../cardCommands"
import { RedBlackButtonHandler } from "../redBlackButtonHandler"
import { RedBlackRound } from "../redBlackInterfaces"

export class RedBlack {

    public static async guessRB(card: ICardObject, customId: string) {
        const guess = RedBlack.getGuessValue(customId, RedBlackRound.RedBlack)
        return guess === 'red' ? ['H','D'].includes(card.suit) : ['S','C'].includes(card.suit)
    }

    public static async guessUD(card: ICardObject, prevCards: ICardObject[], customId: string) {
        const guess = RedBlack.getGuessValue(customId, RedBlackRound.UpDown)
        const prevCard = prevCards.pop()
        if (guess === 'up') return card.number > prevCard.number
        if (guess === 'down') return card.number < prevCard.number
        return card.number == prevCard.number
    }

    public static async guessIO(card: ICardObject, prevCards: ICardObject[], customId: string) {
        const guess = RedBlack.getGuessValue(customId, RedBlackRound.InsideOutside)
        const highCard = prevCards.pop()
        const lowCard = prevCards.pop()
        if (guess === 'in') return card.number > lowCard.number && card.number < highCard.number
        if (guess === 'out') return card.number < lowCard.number || card.number > highCard.number
        return card.number == highCard.number || card.number == lowCard.number
    }

    public static async guessSuit(card: ICardObject, customId: string) {
        const guess = RedBlack.getGuessValue(customId, RedBlackRound.Suit)
        return guess === card.suit
    }

    public static getGuessValue(customId: string, round: RedBlackRound) {
        let toReplace = "";
        if (round === RedBlackRound.RedBlack) toReplace = RedBlackButtonHandler.GUESS_RED_BLACK
        else if (round === RedBlackRound.UpDown) toReplace = RedBlackButtonHandler.GUESS_UP_DOWN
        else if (round === RedBlackRound.InsideOutside) toReplace = RedBlackButtonHandler.GUESS_IN_OUT
        else if (round === RedBlackRound.Suit) toReplace = RedBlackButtonHandler.GUESS_SUIT
        return customId.replace(toReplace, '');
    }

    public static getTranslatedGuessValue(customId: string, round: RedBlackRound) {
        return RedBlack.guessTranslations.get(RedBlack.getGuessValue(customId, round))
    }

    static guessTranslations: Map<string, string> = new Map<string, string>([
        ['red', 'rød'],
        ['black', 'svart'],
        ['up', 'opp'],
        ['down', 'ned'],
        ['same', 'likt'],
        ['in', 'innenfor'],
        ['out', 'utenfor'],
        ['S', ' spar '],
        ['C', ' kløver '],
        ['H', ' hjerter '],
        ['D', ' ruter '],
    ])
}