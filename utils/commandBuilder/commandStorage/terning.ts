import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

export const terningCommand: ISlashCommandItem = {
    commandName: 'terning',
    commandDescription: 'trill en terning',
    options: [
        {
            name: 'sider',
            description: 'velg meme du skal lage',
            type: ApplicationCommandOptionType.Number,
            required: false,
            autocomplete: true,
        },
    ],
}
