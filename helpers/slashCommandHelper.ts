import { CacheType, CommandInteraction, Interaction } from 'discord.js'
import { discordSecret } from '../client-env'

const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v9')
const { SlashCommandBuilder } = require('@discordjs/builders')
export class SlashCommandHelper {
    static async buildCommands() {
        const rest = new REST({ version: '9' }).setToken(discordSecret)

        const dropCommand = new SlashCommandBuilder()
            .setName('drop')
            .setDescription('Få et tilfeldig drop i Warzone')
            .addStringOption((option) =>
                option
                    .setName('map')
                    .setDescription('Velg et map')
                    .setRequired(true)
                    .addChoice('caldera', 'caldera')
                    .addChoice('rebirth island', 'rebirth')
                    .addChoice("fortune's keep", 'fortune')
            )

        // await rest.put(Routes.applicationCommands(''), { body: [dropCommand] })
    }

    /** Get the interaction typed as CommandInteraction */
    static getTypedInteraction(interaction: Interaction<CacheType>) {
        return interaction as CommandInteraction<CacheType>
    }
}
