import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js'

const HEARTS = '1107629203156910102'
const SPADES = '1107629201428852746'
const DIAMONDS = '1107629199935672370'
const CLUBS = '1107629197037412414'

export const moveBtn = new ButtonBuilder({
    custom_id: `RB_MOVE`,
    style: ButtonStyle.Secondary,
    label: `Flytt ned`,
    disabled: false,
    type: 2,
})

const busMoveBtn = new ButtonBuilder({
    custom_id: `RB_MOVE_BUS`,
    style: ButtonStyle.Secondary,
    label: `Flytt ned`,
    disabled: false,
    type: 2,
})

export const setupGameButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `RB_JOIN`,
        style: ButtonStyle.Primary,
        label: `Bli med!`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_START`,
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
        custom_id: `RB_GUESS;RB;red`,
        style: ButtonStyle.Success,
        label: `🟥`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_GUESS;RB;black`,
        style: ButtonStyle.Success,
        label: `⬛`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const upDownButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `RB_GUESS;UD;up`,
        style: ButtonStyle.Success,
        label: `Opp`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_GUESS;UD;down`,
        style: ButtonStyle.Success,
        label: `Ned`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_GUESS;UD;same`,
        style: ButtonStyle.Success,
        label: `Lik`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const insideOutsideButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `RB_GUESS;IO;in`,
        style: ButtonStyle.Success,
        label: `Innenfor`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_GUESS;IO;out`,
        style: ButtonStyle.Success,
        label: `Utenfor`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_GUESS;IO;same`,
        style: ButtonStyle.Success,
        label: `Lik`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const suitButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `RB_GUESS;SUIT;H`,
        style: ButtonStyle.Success,
        emoji: {id: HEARTS},
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_GUESS;SUIT;D`,
        style: ButtonStyle.Success,
        emoji: {id: DIAMONDS},
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_GUESS;SUIT;S`,
        style: ButtonStyle.Success,
        emoji: {id: SPADES},
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_GUESS;SUIT;C`,
        style: ButtonStyle.Success,
        emoji: {id: CLUBS},
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const gtButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `RB_PLACE`,
        style: ButtonStyle.Primary,
        label: `Legg kort`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_NEXT_CARD`,
        style: ButtonStyle.Success,
        label: `Snu neste`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_MY_CARDS`,
        style: ButtonStyle.Secondary,
        label: `Mine kort`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const gtStartButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `RB_NEXT_CARD`,
        style: ButtonStyle.Success,
        label: `Snu første`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)


export const nextPhaseBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `RB_NEXT_PHASE`,
        style: ButtonStyle.Success,
        label: `Neste del ➡️`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const canadianBusrideButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `RB_BUS_CAN;up`,
        style: ButtonStyle.Success,
        label: `Opp`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_BUS_CAN;down`,
        style: ButtonStyle.Success,
        label: `Ned`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_BUS_CAN;same`,
        style: ButtonStyle.Success,
        label: `Lik`,
        disabled: false,
        type: 2,
    }),
    busMoveBtn
)

export const revealLoserBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `RB_PLACE`,
        style: ButtonStyle.Primary,
        label: `Legg kort`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `RB_REVEAL`,
        style: ButtonStyle.Danger,
        label: `Avslør taperen`,
        disabled: false,
        type: 2,
    }),
    moveBtn
)

export const TryAgainBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `RB_TRY_AGAIN`,
        style: ButtonStyle.Primary,
        label: `Prøv igjen :)`,
        disabled: false,
        type: 2,
    }),
    busMoveBtn
)
