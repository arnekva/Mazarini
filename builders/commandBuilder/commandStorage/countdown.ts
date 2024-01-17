import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the countdown command */
export const countdownCommand: ISlashCommandItem = {
    commandName: 'countdown',
    commandDescription: 'lag eller vis countdowner',
    subCommands: [
        {
            commandName: 'sett',
            commandDescription: 'Vis bibliotek',
            options: [
                {
                    name: 'dato',
                    description: 'dd-mm-yyyy',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: 'klokkeslett',
                    description: 'HH:MM',
                    type: ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: 'hendelse',
                    description: 'hva countdownen er',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: 'tags',
                    description: 'komma-separerte tags',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                },
            ],
        },
        {
            commandName: 'vis',
            commandDescription: 'vis countdowner',
        },
    ],
}
