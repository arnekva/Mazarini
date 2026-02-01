import { randomUUID } from 'crypto'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { AbstractCommands } from '../../Abstracts/AbstractCommand'
import { BtnInteraction, ChatInteraction } from '../../Abstracts/MazariniInteraction'
import { MazariniClient } from '../../client/MazariniClient'
import { ComponentsHelper } from '../../helpers/componentsHelper'
import { IInteractionElement } from '../../interfaces/interactionInterface'
import { CCG_Helper } from '../../templates/containerTemplates'
import { CCGHelper, CCGHelperCategory, CCGHelperSubCategory } from './ccgInterface'
import { HelperText } from './helpTexts'

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
            selectedSubCategory: undefined,
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
        container.replaceComponent('categories', getCategories(helper))
        if (helper.selectedCategory) {
            container.updateTextComponent('categoryInfo', HelperText[helper.selectedCategory])
            const subCategories = categoryMap.get(helper.selectedCategory)
            if (subCategories && subCategories.length > 0) {
                container.addComponentAfterReference('separator_before_sub', ComponentsHelper.createSeparatorComponent(), 'categoryInfo')
                container.addComponentAfterReference('subCategories', getSubCategories(helper), 'separator_before_sub')
                container.addComponentAfterReference('separator_after_sub', ComponentsHelper.createSeparatorComponent(), 'subCategories')
            }
        }
        if (helper.selectedSubCategory) {
            container.addComponentAfterReference(
                'subCategoryInfo',
                ComponentsHelper.createTextComponent().setContent(HelperText[helper.selectedSubCategory]),
                'separator_after_sub'
            )
        }
        return container
    }

    public setCategory(interaction: BtnInteraction) {
        const customId = interaction.customId.split(';')
        const helper = this.helpers.get(customId[1])
        if (!helper) return this.messageHelper.replyToInteraction(interaction, 'Denne er utdatert, åpne en ny hjelper med /ccg help', { ephemeral: true })
        interaction.deferUpdate()
        helper.selectedCategory = customId[2] as CCGHelperCategory
        helper.selectedSubCategory = undefined
        this.updateHelper(helper)
    }

    public setSubCategory(interaction: BtnInteraction) {
        const customId = interaction.customId.split(';')
        const helper = this.helpers.get(customId[1])
        if (!helper) return this.messageHelper.replyToInteraction(interaction, 'Denne er utdatert, åpne en ny hjelper med /ccg help', { ephemeral: true })
        interaction.deferUpdate()
        helper.selectedSubCategory = customId[2] as CCGHelperSubCategory
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

const getCategories = (helper: CCGHelper) => {
    const categories = Array.from(categoryMap.keys())
    const components: Array<ButtonBuilder> = new Array<ButtonBuilder>()
    for (const category of categories) {
        components.push(categoryButton(helper.id, category, helper.selectedCategory === category))
    }
    return new ActionRowBuilder<ButtonBuilder>().addComponents(components)
}

const getSubCategories = (helper: CCGHelper) => {
    const subCategories = categoryMap.get(helper.selectedCategory)
    const components: Array<ButtonBuilder> = new Array<ButtonBuilder>()
    for (const subCategory of subCategories) {
        components.push(subCategoryButton(helper.id, subCategory, helper.selectedSubCategory === subCategory))
    }
    return new ActionRowBuilder<ButtonBuilder>().addComponents(components)
}

const categoryMap: Map<CCGHelperCategory, CCGHelperSubCategory[]> = new Map([
    [
        CCGHelperCategory.Gameplay,
        [
            CCGHelperSubCategory.Game_modes,
            CCGHelperSubCategory.Rounds,
            CCGHelperSubCategory.Card_resolution,
            CCGHelperSubCategory.Statuses_and_effects,
            CCGHelperSubCategory.Winning_and_losing,
        ],
    ],
    [CCGHelperCategory.Cards, [CCGHelperSubCategory.Card_anatomy, CCGHelperSubCategory.Balancing]],
    [CCGHelperCategory.Decks, [CCGHelperSubCategory.Deck_rules, CCGHelperSubCategory.Deck_builder, CCGHelperSubCategory.Commands]],
    [
        CCGHelperCategory.Progression,
        [CCGHelperSubCategory.Card_acquisition, CCGHelperSubCategory.Rewards, CCGHelperSubCategory.Economy, CCGHelperSubCategory.Seasons],
    ],
    [CCGHelperCategory.Stats, [CCGHelperSubCategory.Player_stats]],
])

const categoryButton = (helperId: string, category: CCGHelperCategory, categoryIsActive = false) => {
    return new ButtonBuilder({
        custom_id: `CCG_HELPER;${helperId};${category}`,
        style: categoryIsActive ? ButtonStyle.Primary : ButtonStyle.Secondary,
        disabled: false,
        label: category.replace(/_/g, ' '),
        type: 2,
    })
}

const subCategoryButton = (helperId: string, subCategory: CCGHelperSubCategory, categoryIsActive = false) => {
    return new ButtonBuilder({
        custom_id: `CCG_HELPER_SUB;${helperId};${subCategory}`,
        style: categoryIsActive ? ButtonStyle.Primary : ButtonStyle.Secondary,
        disabled: false,
        label: subCategory.replace(/_/g, ' '),
        type: 2,
    })
}
