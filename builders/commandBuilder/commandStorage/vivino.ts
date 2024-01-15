import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Vivino command */
export const vivinoCommand: ISlashCommandItem = {
    commandName: 'vivino',
    commandDescription: 'se vin-året ditt',
    options: [
        {
            name: 'year',
            description: 'årstall du vil sjekke',
            type: ApplicationCommandOptionType.Number,
            required: false,
            choices: [
                {
                    name: '2024',
                    value: 2024,
                },
                {
                    name: '2023',
                    value: 2023,
                },
                {
                    name: '2022',
                    value: 2022,
                },
            ]
        },]
}
