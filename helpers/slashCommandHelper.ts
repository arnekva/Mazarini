import { CacheType, CommandInteraction, Interaction } from 'discord.js'

// const { REST } = require('@discordjs/rest')
// const { Routes } = require('discord-api-types/v9')
// const { SlashCommandBuilder } = require('@discordjs/builders')
export class SlashCommandHelper {
    static async buildCommands() {
        // const rest = new REST({ version: '9' }).setToken(discordSecret)
        // const dropCommand = new SlashCommandBuilder()
        //     .setName('musikk')
        //     .setDescription('Se Last.fm Data')
        //     .addStringOption((option) =>
        //         option
        //             .setName('data')
        //             .setDescription('Velg hvilke data du vil hente')
        //             .setRequired(true)
        //             .addChoice('topp ti artister', 'toptenartist')
        //             .addChoice('topp ti sanger', 'toptensongs')
        //             .addChoice('topp ti album', 'toptenalbum')
        //             .addChoice('siste ti sanger', 'lasttensongs')
        //     )
        //     .addUserOption((option) => option.setName('user').setDescription('Velg en bruker å se dataen til'))
        // await rest.put(Routes.applicationCommands(''), { body: [dropCommand] })
    }

    /** Get the interaction typed as CommandInteraction */
    static getTypedInteraction(interaction: Interaction<CacheType>): CommandInteraction<CacheType> | undefined {
        return interaction.isCommand() ? (interaction as CommandInteraction<CacheType>) : undefined
    }
}
