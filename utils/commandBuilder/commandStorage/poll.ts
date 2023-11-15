import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Poll command */
export const pollCommand: ISlashCommandItem = {
    commandName: 'poll',
    commandDescription: 'lag en poll',
    subCommands: [
        {
            commandName: 'vis',
            commandDescription: 'Vis en poll',
            options: [
                {
                    name: 'pollnavn',
                    description: 'hva pollen handler om',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
            ],
        },
        {
            commandName: 'lag',
            commandDescription: 'Vis status',
            options: [
                {
                    name: 'beskrivelse',
                    description: 'hva pollen handler om',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },

                {
                    name: '1',
                    description: 'valg',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: '2',
                    description: 'valg',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: '3',
                    description: 'valg',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                },
                {
                    name: '4',
                    description: 'valg',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                },
                {
                    name: '5',
                    description: 'valg',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                },
                {
                    name: 'flersvar',
                    description: 'svare på mer enn ett valg',
                    type: ApplicationCommandOptionType.Boolean,
                    required: false,
                },
            ],
        },
    ],
}
