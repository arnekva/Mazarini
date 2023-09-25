import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const rollCommand: ISlashCommandItem = {
    commandName: 'terning',
    commandDescription: 'trill en terning (default 1-10)',
    options: [
        {
            name: 'sider',
            description: 'velg hvor mange sider det er på terningen (f.eks 10 triller 1-10)',
            type: ApplicationCommandOptionType.Number,
            required: false,
        },
    ],
}
