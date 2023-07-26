import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js'
import { RedBlackButtonHandler } from './redBlackButtonHandler'

const HEARTS = '1107629203156910102'
const SPADES = '1107629201428852746'
const DIAMONDS = '1107629199935672370'
const CLUBS = '1107629197037412414'

export const moveBtn = new ButtonBuilder({
    custom_id: `${RedBlackButtonHandler.MOVE}`,
    style: ButtonStyle.Secondary,
    label: `Flytt ned`,
    disabled: false,
    type: 2,
})

const busMoveBtn = new ButtonBuilder({
    custom_id: `${RedBlackButtonHandler.MOVE_BUS}`,
    style: ButtonStyle.Secondary,
    label: `Flytt ned`,
    disabled: false,
    type: 2,
})

export const setupGameButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.JOIN}`,
        style: ButtonStyle.Primary,
        label: `Bli med!`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.START}`,
        style: ButtonStyle.Success,
        label: `🍷 Start 🍷`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)
//TODO: Legg til emoji i label
export const redBlackButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_RED_BLACK}red`,
        style: ButtonStyle.Success,
        label: `🟥`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_RED_BLACK}black`,
        style: ButtonStyle.Success,
        label: `⬛`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const upDownButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_UP_DOWN}up`,
        style: ButtonStyle.Success,
        label: `Opp`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_UP_DOWN}down`,
        style: ButtonStyle.Success,
        label: `Ned`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_UP_DOWN}same`,
        style: ButtonStyle.Success,
        label: `Lik`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const insideOutsideButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_IN_OUT}in`,
        style: ButtonStyle.Success,
        label: `Innenfor`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_IN_OUT}out`,
        style: ButtonStyle.Success,
        label: `Utenfor`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_IN_OUT}same`,
        style: ButtonStyle.Success,
        label: `Lik`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const suitButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_SUIT}H`,
        style: ButtonStyle.Success,
        emoji: {id: HEARTS},
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_SUIT}D`,
        style: ButtonStyle.Success,
        emoji: {id: DIAMONDS},
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_SUIT}S`,
        style: ButtonStyle.Success,
        emoji: {id: SPADES},
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS_SUIT}C`,
        style: ButtonStyle.Success,
        emoji: {id: CLUBS},
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const gtButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.PLACE}`,
        style: ButtonStyle.Primary,
        label: `Legg kort`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.NEXT_CARD}`,
        style: ButtonStyle.Success,
        label: `Snu neste`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.MY_CARDS}`,
        style: ButtonStyle.Secondary,
        label: `Mine kort`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const gtStartButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.NEXT_CARD}`,
        style: ButtonStyle.Success,
        label: `Snu første`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)


export const nextPhaseBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.NEXT_PHASE}`,
        style: ButtonStyle.Success,
        label: `Neste del ➡️`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const canadianBusrideButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.CANADIAN_GUESS}up`,
        style: ButtonStyle.Success,
        label: `Opp`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.CANADIAN_GUESS}down`,
        style: ButtonStyle.Success,
        label: `Ned`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.CANADIAN_GUESS}same`,
        style: ButtonStyle.Success,
        label: `Lik`,
        disabled: false,
        type: 2,
    }),
    busMoveBtn
)

export const revealLoserBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.PLACE}`,
        style: ButtonStyle.Primary,
        label: `Legg kort`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.REVEAL_LOSER}`,
        style: ButtonStyle.Danger,
        label: `Avslør taperen`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const TryAgainBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.TRY_AGAIN}`,
        style: ButtonStyle.Primary,
        label: `Prøv igjen :)`,
        disabled: false,
        type: 2,
    }),
    busMoveBtn
)
