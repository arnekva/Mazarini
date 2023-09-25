import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const musikkCommand: ISlashCommandItem = {
    commandName: 'musikk',
    commandDescription: 'se statistikk for musikken din',
    options: [
        {
            name: 'data',
            description: 'Velg hvilke data som skal hentes',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                {
                    name: 'topp ti sanger',
                    value: 'toptensongs',
                },
                {
                    name: 'topp ti artister',
                    value: 'toptenartist',
                },
                {
                    name: 'topp ti album',
                    value: 'toptenalbum',
                },
                {
                    name: 'siste ti sanger',
                    value: 'lasttensongs',
                },
            ],
        },
        {
            name: 'user',
            description: 'user',
            type: ApplicationCommandOptionType.User,
            required: false,
        },
        {
            name: 'periode',
            description: 'tidsperiode',
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
                {
                    name: 'overall',
                    value: 'overall',
                },
                {
                    name: 'week',
                    value: '7day',
                },
                {
                    name: 'month',
                    value: '1month',
                },
                {
                    name: 'three months',
                    value: '3month',
                },
                {
                    name: 'six months',
                    value: '6month',
                },
                {
                    name: 'year',
                    value: '12month',
                },
            ],
        },
    ],
}
