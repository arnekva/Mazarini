import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const lyricsCommand: ISlashCommandItem = {
    commandName: 'lyrics',
    commandDescription: 'finn lyrics for sangen',
    options: [
        {
            name: 'sang',
            description: 'navn på sang',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'artist',
            description: 'navn på artist',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
    ],
}
