import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Poll command */
export const statsCommand: ISlashCommandItem = {
    commandName: 'stats',
    commandDescription: 'Hent diverse statistikk',
    subCommands: [
        {
            commandName: 'bruker',
            commandDescription: 'Tidligere /brukerstats',
            options: [
                {
                    name: 'kategori',
                    description: 'hvilken kategori av statistikk vil du se - default alle',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: 'deathroll', value: 'deathroll' },
                        { name: 'deathroll alltime', value: 'deathroll alltime' },
                        { name: 'gambling', value: 'gambling' },
                        { name: 'rulett', value: 'rulett' },
                        { name: 'deal or no deal', value: 'dond' },
                    ],
                },
                {
                    name: 'bruker',
                    description: 'bruker du vil se statistikk for - default deg selv',
                    type: ApplicationCommandOptionType.User,
                },
            ],
        },
    ],
    subCommandGroups: [
        {
            commandName: 'emoji',
            commandDescription: 'emoji relatert statistikk',
            subCommands: [
                {
                    commandName: 'søk',
                    commandDescription: 'Hent stats for en spesifikk emoji',
                    options: [
                        {
                            name: 'emojinavn',
                            description: 'emojien du vil se statistikk for',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                    ],
                },
                {
                    commandName: 'toppliste',
                    commandDescription: 'Hent stats for de mest/minst brukte emojiene',
                    options: [
                        {
                            name: 'data',
                            description: 'Angi om den skal hente de mest eller minst brukte',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: 'topp', value: 'top' },
                                { name: 'bunn', value: 'bottom' },
                            ],
                        },
                        {
                            name: 'antall',
                            description: 'default 9',
                            type: ApplicationCommandOptionType.Integer,
                        },
                        {
                            name: 'type',
                            description: 'Default sjekkes både animerte og ikke animerte',
                            type: ApplicationCommandOptionType.String,
                            choices: [
                                { name: 'standard', value: 'standard' },
                                { name: 'animert', value: 'animert' },
                                { name: 'alle', value: 'alle' },
                            ],
                        },
                        {
                            name: 'sortering',
                            description: 'Angi hvilken statistikk de sorteres etter. Default total',
                            type: ApplicationCommandOptionType.String,
                            choices: [
                                { name: 'meldinger', value: 'meldinger' },
                                { name: 'reaksjoner', value: 'reaksjoner' },
                                { name: 'gjennomsnitt', value: 'gjennomsnitt' },
                                { name: 'total', value: 'total' },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
}
