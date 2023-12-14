import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const memeCommand: ISlashCommandItem = {
    commandName: 'meme',
    commandDescription: 'lag et meme',
    options: [
        {
            name: 'meme',
            description: 'velg meme du skal lage',
            type: ApplicationCommandOptionType.String,
            required: true,
            autocomplete: true
        },
        {
            name: 'tekst-1',
            description: 'tekst 1',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'tekst-2',
            description: 'tekst 2',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'tekst-3',
            description: 'tekst 3',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'tekst-4',
            description: 'tekst 4',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'preview',
            description: 'få meme-en tilsendt som en ephemeral melding',
            type: ApplicationCommandOptionType.Boolean,
            required: false,
        },
    ],
}

