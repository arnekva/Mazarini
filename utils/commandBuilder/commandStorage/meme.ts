import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const memeCommand: ISlashCommandItem = {
    commandName: 'meme',
    commandDescription: 'lag et meme',
    options: [
        {
            name: 'meme',
            description: 'velg meme du skal lage',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                {
                    name: "timmy's dad",
                    value: 'timmy',
                },
                {
                    name: 'sjosyk',
                    value: 'sjosyk',
                },
                {
                    name: 'anakin',
                    value: 'anakin',
                },
                {
                    name: 'draw',
                    value: 'draw',
                },
            ],
        },
        {
            name: 'tekst-1',
            description: 'tekst 1',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'tekst-2',
            description: 'tekst 2',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'tekst-3',
            description: 'tekst 3',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'tekst-3',
            description: 'tekst 3',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
    ],
}
