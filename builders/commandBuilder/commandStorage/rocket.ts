import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const rocketCommand: ISlashCommandItem = {
    commandName: 'rocket',
    commandDescription: 'Rocket League stats',
    options: [
        {
            name: 'modus',
            description: 'Hvilke stats vil du hente?',
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
                { name: '1v1', value: '1v1' },
                { name: '2v2', value: '2v2' },
                { name: '3v3', value: '3v3' },
                { name: 'Tournament', value: 'tournament' },
                { name: 'Lifetime', value: 'lifetime' },
            ],
        },
    ],
}
