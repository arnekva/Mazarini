import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

export const terningCommand: ISlashCommandItem = {
    commandName: 'terning',
    commandDescription: 'trill en terning',
    options: [
        {
            name: 'sider',
            description: 'velg antall sider å trille',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            autocomplete: true,
        },
    ],
}
