import { randomUUID } from 'crypto'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { CCG_Helper } from '../../templates/containerTemplates'
import { CCGHelper, CCGHelperCategory } from './ccgInterface'

export class CCGHelp extends AbstractCommands {
    private helpers: Map<string, CCGHelper>

    constructor(client: MazariniClient) {
        super(client)
        this.helpers = new Map<string, CCGHelper>()
    }

    public async newCCGHelper(interaction: ChatInteraction) {
        const helperId = randomUUID()
        const helper: CCGHelper = {
            id: helperId,
            selectedCategory: undefined,
            info: {
                container: undefined,
                message: undefined,
            },
        }
        const container = this.newInfoContainer(helper)
        helper.info.container = container
        const infoMsg = await this.messageHelper.replyToInteraction(interaction, '', undefined, [container.container])
        helper.info.message = infoMsg
        this.helpers.set(helperId, helper)
    }

    private newInfoContainer(helper: CCGHelper) {
        const container = CCG_Helper()
        container.replaceComponent('categories', categories(helper))
        if (helper.selectedCategory) {
            container.updateTextComponent('categoryInfo', this.getCategoryInfo(helper.selectedCategory))
        }
        return container
    }

    private getCategoryInfo(category: CCGHelperCategory) {
        switch (category) {
            case CCGHelperCategory.Gameplay:
                return gameplayHelp
            case CCGHelperCategory.Cards:
                return cardHelp
            case CCGHelperCategory.Deck:
                return deckHelp
            case CCGHelperCategory.Rules:
                return rulesHelp
            default:
                return ''
        }
    }

    public setCategory(interaction: BtnInteraction) {
        interaction.deferUpdate()
        const customId = interaction.customId.split(';')
        const helper = this.helpers.get(customId[1])
        helper.selectedCategory = customId[2] as CCGHelperCategory
        this.updateHelper(helper)
    }

    private updateHelper(helper: CCGHelper) {
        const container = this.newInfoContainer(helper)
        helper.info.container = container
        helper.info.message.edit({ components: [helper.info.container.container] })
    }

    getAllInteractions(): IInteractionElement {
        throw new Error('Method not implemented.')
    }
}

const categories = (helper: CCGHelper) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        categoryButton(helper.id, CCGHelperCategory.Gameplay, helper.selectedCategory === CCGHelperCategory.Gameplay),
        categoryButton(helper.id, CCGHelperCategory.Deck, helper.selectedCategory === CCGHelperCategory.Deck),
        categoryButton(helper.id, CCGHelperCategory.Cards, helper.selectedCategory === CCGHelperCategory.Cards),
        categoryButton(helper.id, CCGHelperCategory.Rules, helper.selectedCategory === CCGHelperCategory.Rules)
    )
}

const categoryButton = (helperId: string, category: CCGHelperCategory, categoryIsActive = false) => {
    return new ButtonBuilder({
        custom_id: `CCG_HELPER;${helperId};${category}`,
        style: categoryIsActive ? ButtonStyle.Primary : ButtonStyle.Secondary,
        disabled: false,
        label: category,
        type: 2,
    })
}

const gameplayHelp = [
    '## 🕹️ Gameplay',
    '**CCG** is a **1v1 turn-based card game** played through Discord buttons.',
    'Both players **secretly select cards** each round.',
    'When both submit, all cards are **revealed and resolved automatically**.',
    '',
    '**Core rules:**',
    '• Players start with **HP** and **Energy**',
    '• **Energy** is spent to play cards',
    '• Cards apply **damage, defense, or effects**',
    '• Rounds repeat until one player reaches **0 HP**',
    '',
    '**The goal:** outplay your opponent and survive.',
].join('\n')

const cardHelp = [
    '## 🃏 Cards',
    'Cards are **emoji-themed actions** with unique effects.',
    '',
    '**Each card has:**',
    '• **Energy cost**',
    '• **Effect** (damage, defense, status, utility)',
    '• **Rarity**',
    '• **Resolution priority**',
    '',
    '**Cards can:**',
    '• Deal or prevent damage',
    '• Apply status effects',
    '• Manipulate Energy or cards',
    '• Counter or modify other cards',
].join('\n')

const deckHelp = [
    '## 🧩 Decks',
    'A deck defines how you play.',
    '',
    '**Deck rules:**',
    '• Decks contain **12 cards**',
    '• You can own **multiple decks**',
    '• Only **one deck** can be active',
    '• Decks are **locked once a game starts**',
    '',
    'Copy limits depend on **card rarity**.',
    'Illegal decks cannot be activated.',
].join('\n')

const rulesHelp = [
    '## 🖱️ UI & Rules',
    'All actions are done using **Discord buttons**.',
    '',
    '**Important rules:**',
    '• Hands are **private**',
    '• Card selection is **simultaneous**',
    '• Once submitted, choices are **locked**',
    '• All effects resolve **automatically in order**',
    '• Status effects tick at **round end**',
].join('\n')
