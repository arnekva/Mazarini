import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the værmelding command (was /weather) */
export const vaermeldingCommand: ISlashCommandItem = {
    commandName: 'værmelding',
    commandDescription: 'Vis værmelding for et sted',
    options: [
        {
            name: 'stedsnavn',
            description: 'Stedet du vil ha værmelding for',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
    ],
}
