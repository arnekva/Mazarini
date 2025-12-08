import { SelectMenuOptionBuilder as BuildersSelectMenuOption } from '@discordjs/builders'
import {
    ActionRowBuilder,
    APISelectMenuOption,
    RestOrArray,
    SelectMenuComponentOptionData,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js'

export class ActionMenuHelper {
    static createSelectMenu(
        id: string,
        placeholderText: string,
        ...options: RestOrArray<BuildersSelectMenuOption | SelectMenuComponentOptionData | APISelectMenuOption | StringSelectMenuOptionBuilder>
    ) {
        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(id)
                .setPlaceholder(placeholderText)
                .addOptions(...options)
        )
    }
}
