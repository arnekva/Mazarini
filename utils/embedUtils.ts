import { APIEmbedField, EmbedBuilder, RestOrArray } from 'discord.js'

export class EmbedUtils {
    static createSimpleEmbed(title: string, description: string, ...fields: RestOrArray<APIEmbedField>): EmbedBuilder {
        const embed = new EmbedBuilder({})
            .setTitle(title)
            .setDescription(description)
            .addFields(...fields)

        return embed
    }
}
