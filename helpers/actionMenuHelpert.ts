import { SelectMenuOptionBuilder as BuildersSelectMenuOption } from '@discordjs/builders'
import { ActionRowBuilder, APISelectMenuOption, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData } from 'discord.js'

export class ActionMenuHelper {
    static creatSelectMenu(
        id: string,
        placeholderText: string,
        ...options: RestOrArray<BuildersSelectMenuOption | SelectMenuComponentOptionData | APISelectMenuOption>
    ) {
        return new ActionRowBuilder<SelectMenuBuilder>().addComponents(
            new SelectMenuBuilder()
                .setCustomId(id)
                .setPlaceholder(placeholderText)
                .addOptions(...options)
        )
    }
}
