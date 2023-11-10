import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Spotify command */
export const spotifyCommand: ISlashCommandItem = {
    commandName: 'spotify',
    commandDescription: 'se spotify data for en bruker eller gruppa',
    subCommands: [
        {
            commandName: 'bruker',
            commandDescription: 'se data for ein spesifikk bruker',
            options: [
                {
                    name: 'user',
                    description: 'bruker du vil se data for',
                    type: ApplicationCommandOptionType.User,
                },
                {
                    name: 'lyrics',
                    description: 'ta med et utdrag av teksten',
                    type: ApplicationCommandOptionType.Boolean,
                },
            ],
        },
        {
            commandName: 'gruppe',
            commandDescription: 'vis status',
            options: [
                {
                    name: 'mode',
                    description: 'bruker du vil se data for',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        {
                            name: 'full',
                            value: 'full',
                        },
                        {
                            name: 'aktive',
                            value: 'active',
                        },
                    ],
                },
            ],
        },
    ],
}
