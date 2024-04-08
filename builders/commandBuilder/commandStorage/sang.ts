import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const sangCommand: ISlashCommandItem = {
    commandName: 'sang',
    commandDescription: 'søk etter en sang',
    options: [
        {
            name: 'sang',
            description: 'navn på sang',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'artist',
            description: 'navn på artist (kan være tom)',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
    ],
}
