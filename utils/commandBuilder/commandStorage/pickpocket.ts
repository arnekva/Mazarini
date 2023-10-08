import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const pickpocketCommand: ISlashCommandItem = {
    commandName: 'pickpocket',
    commandDescription: 'prøv å stjele chips fra noen',
    options: [
        {
            name: 'bruker',
            description: 'hvem prøver du å stjele fra',
            type: ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: 'chips',
            description: 'hvor mye prøver du å stjele',
            type: ApplicationCommandOptionType.Number,
            required: true,
        },
    ],
}
