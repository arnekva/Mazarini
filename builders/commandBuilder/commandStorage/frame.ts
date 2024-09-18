import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const frameCommand: ISlashCommandItem = {
    commandName: 'frame',
    commandDescription: 'prøv å legge skylden på noen andre',
    options: [
        {
            name: 'bruker',
            description: 'hvem prøver du å legge skylden på',
            type: ApplicationCommandOptionType.User,
            required: true,
        }
    ],
}
