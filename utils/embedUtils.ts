import { EmbedBuilder } from '@discordjs/builders'
import { APIEmbedField, RestOrArray } from 'discord.js'

export class EmbedUtils {
    static createSimpleEmbed(title: string, description: string, ...fields: RestOrArray<APIEmbedField>) {
        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .addFields(...fields)
    }
}
