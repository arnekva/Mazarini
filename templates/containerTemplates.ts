import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { SimpleContainer } from '../Abstracts/SimpleContainer'
import { ComponentsHelper } from '../helpers/componentsHelper'

export const inventoryContainer = () => {
    const container = new SimpleContainer()
    container.addComponent(ComponentsHelper.createTextComponent().setContent('## Inventory'), 'header')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator1')
    container.addComponent(ComponentsHelper.createTextComponent().setContent('Oppdaterer...'), 'common')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator2')
    container.addComponent(ComponentsHelper.createTextComponent().setContent('Oppdaterer...'), 'rare')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator3')
    container.addComponent(ComponentsHelper.createTextComponent().setContent('Oppdaterer...'), 'epic')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator4')
    container.addComponent(ComponentsHelper.createTextComponent().setContent('Oppdaterer...'), 'legendary')
    return container
}

export const mastermindContainer = () => {
    const container = new SimpleContainer()
    container.addComponent(ComponentsHelper.createTextComponent().setContent('## Mastermind'), 'header')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator1')
    container.addComponent(ComponentsHelper.createTextComponent().setContent(':arrow_left:'), 'guess1')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator2')
    container.addComponent(buttons1, 'buttons1')
    container.addComponent(buttons2, 'buttons2')
    container.addComponent(buttons3, 'buttons3')
    return container
}

const buttons1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `MASTERMIND_COLOR;red`,
        style: ButtonStyle.Secondary,
        label: '🟥',
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `MASTERMIND_COLOR;blue`,
        style: ButtonStyle.Secondary,
        label: '🟦',
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `MASTERMIND_COLOR;yellow`,
        style: ButtonStyle.Secondary,
        label: '🟨',
        disabled: false,
        type: 2,
    })
)

const buttons2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `MASTERMIND_COLOR;green`,
        style: ButtonStyle.Secondary,
        label: '🟩',
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `MASTERMIND_COLOR;black`,
        style: ButtonStyle.Secondary,
        label: '⬛',
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `MASTERMIND_COLOR;white`,
        style: ButtonStyle.Secondary,
        label: '⬜',
        disabled: false,
        type: 2,
    })
)

const buttons3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder({
        custom_id: `MASTERMIND_RESET`,
        style: ButtonStyle.Danger,
        label: 'Reset',
        disabled: false,
        type: 2,
    }),
    new ButtonBuilder({
        custom_id: `MASTERMIND_SUBMIT`,
        style: ButtonStyle.Success,
        label: 'Submit',
        disabled: false,
        type: 2,
    })
)
