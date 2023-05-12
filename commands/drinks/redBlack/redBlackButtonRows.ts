import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js'
import { RedBlackButtonHandler } from './redBlackButtonHandler'


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
    })
)
//TODO: Legg til emoji i label
export const redBlackButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS}Red`,
        style: ButtonStyle.Secondary,
        label: `Rød`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.GUESS}Black`,
        style: ButtonStyle.Secondary,
        label: `Svart`,
        disabled: false,
        type: 2,
    })
)

export const giveTakeButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.PLACE}`,
        style: ButtonStyle.Primary,
        label: `Legg ned kort`,
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `${RedBlackButtonHandler.NEXT_CARD}`,
        style: ButtonStyle.Success,
        label: `Neste kort`,
        disabled: false,
        type: 2,
    })
)

