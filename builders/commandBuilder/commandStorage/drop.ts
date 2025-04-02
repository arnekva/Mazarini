import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Vivino command */
export const dropCommand: ISlashCommandItem = {
    commandName: 'drop',
    commandDescription: 'Få et tilfeldig drop i Warzone',
    subCommands: [
        {
            commandName: 'grid',
            commandDescription: 'Få et tilfeldig drop i Warzone ut fra Grid i Verdansk',
            options: [
                {
                    name: 'placement',
                    description: 'koordinatene for midten av sirkelen i rutenettet',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            commandName: 'poi',
            commandDescription: 'Få et tilfeldig drop i Warzone',
            options: [
                {
                    name: 'map',
                    description: 'velg et map',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        {
                            name: 'Verdansk',
                            value: 'verdansk',
                        },
                        {
                            name: 'Rebirth',
                            value: 'rebirth',
                        },
                    ],
                },
            ],
        },
    ],
}
