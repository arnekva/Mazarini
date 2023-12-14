import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Stopp command */
export const stoppCommand: ISlashCommandItem = {
    commandName: 'stopp',
    commandDescription: 'stopp botinstanser av et miljo',
    options: [
        {
            name: 'env',
            description: 'hvilken bot som skal stoppes',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                {
                    name: 'local',
                    value: 'local',
                },
                {
                    name: 'prod',
                    value: 'prod',
                },
            ],
        },
    ],
}
