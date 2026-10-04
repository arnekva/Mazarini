import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Kjevle command */
export const kjevleCommand: ISlashCommandItem = {
    commandName: 'kjevle',
    commandDescription: 'gi noen en kjevle i hodet',
    options: [
        {
            name: 'bruker',
            description: 'hvem skal få kjevla',
            type: ApplicationCommandOptionType.User,
            required: true,
        },
    ],
}
