import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { SimpleContainer } from '../Abstracts/SimpleContainer'
import { DeckEditor } from '../commands/ccg/ccgInterface'
import { GameValues } from '../general/values'
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

export const CCGContainer = (gameId: string, player1: string, vsBot = false) => {
    const container = new SimpleContainer()
    container.addComponent(ComponentsHelper.createTextComponent().setContent('## Mazarini CCG'), 'header')
    container.addComponent(ComponentsHelper.createTextComponent().setContent(`### ${player1} vs ${vsBot ? 'Høie' : '...'}`), 'sub-header')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator1')
    container.addComponent(buttons1, 'main-button')
    return container
}

export const CCGDeckEditor_Info = (editor: DeckEditor) => {
    const container = new SimpleContainer()
    container.addComponent(ComponentsHelper.createTextComponent().setContent(`## Deck Editor`), 'header')
    container.addComponent(buttons1, 'save_button')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator1')
    container.addComponent(ComponentsHelper.createTextComponent().setContent(`### ${editor.deck.name}`), 'deckName')
    const numberOfCards = Array.from(editor.deck.cards ?? []).reduce((sum, instance) => sum + instance.amount, 0)
    container.addComponent(ComponentsHelper.createTextComponent().setContent(`${numberOfCards} / ${GameValues.ccg.deck.size} cards`), 'deckInfo')
    if (editor.validationErrors?.length ?? 0 > 0) {
        const validationErrors = editor.validationErrors.join('\n')
        container.addComponent(ComponentsHelper.createTextComponent().setContent(`${validationErrors}`), 'validationErrors')
    }
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator2')
    container.addComponent(ComponentsHelper.createTextComponent().setContent(`### Filters`), 'filter_header')
    container.addComponent(buttons1, 'typeFilters')
    container.addComponent(buttons2, 'rarityFilters')
    container.addComponent(buttons3, 'usageFilters')
    if (GameValues.ccg.activeCCGseries.length > 1) {
        container.addComponent(buttons3, 'seriesFilters')
    }
    // container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator3')
    // container.addComponent(ComponentsHelper.createTextComponent().setContent(`### Sort by`), 'sorting_header')
    // container.addComponent(buttons1, 'sorting')
    return container
}

export const CCG_Helper = () => {
    const container = new SimpleContainer()
    container.addComponent(ComponentsHelper.createTextComponent().setContent(`## CCG Helper\n### Velg et tema du vil vite mer om`), 'header')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator1')
    container.addComponent(buttons1, 'categories')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator2')
    container.addComponent(ComponentsHelper.createTextComponent().setContent(`## Documentation`), 'categoryInfo')
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
