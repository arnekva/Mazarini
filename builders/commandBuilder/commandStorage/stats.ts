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
                            autocomplete: true
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
                                { name: "topp", value: "top"},
                                { name: "bunn", value: "bottom"},
                            ]
                        },
                        {
                            name: 'antall',
                            description: 'default 10',
                            type: ApplicationCommandOptionType.Number,
                        },
                        {
                            name: 'ignorer',
                            description: 'default sjekkes både meldinger og reaksjoner',
                            type: ApplicationCommandOptionType.String,
                            choices: [
                                { name: "meldinger", value: "ignoreMessages"},
                                { name: "reaksjoner", value: "ignoreReactions"},
                            ]
                        },
                    ],
                },
            ]
        },
    ],
}
