import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const jailbreakCommand: ISlashCommandItem = {
    commandName: 'jailbreak',
    commandDescription: 'prøv å rømma fra fengsel',
    options: [
        {
            name: 'bribe',
            description: 'du kan velge å bribe vakten for 20% av alle chipså dine (men minst 10k)',
            type: ApplicationCommandOptionType.Boolean,
            required: false,
        },
    ],
}
