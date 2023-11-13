import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Music command */
export const musicCommand: ISlashCommandItem = {
    commandName: 'musikkbibliotek',
    commandDescription: 'lag en poll',
    subCommands: [
        {
            commandName: 'vis',
            commandDescription: 'Vis bibliotek',
            options: [
                {
                    name: 'data',
                    description: 'hva pollen handler om',
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
                    name: 'bruker',
                    description: 'bruker du vil se data for',
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
                            name: 'all-time',
                            value: 'overall',
                        },
                        {
                            name: 'uke',
                            value: '7day',
                        },
                        {
                            name: 'måned',
                            value: '1month',
                        },
                        {
                            name: 'tre måneder',
                            value: '3month',
                        },
                        {
                            name: 'seks måneder',
                            value: '6month',
                        },
                        {
                            name: 'år',
                            value: '12month',
                        },
                    ],
                },
            ],
        },
        {
            commandName: 'søk',
            commandDescription: 'søk i biblioteket ditt',
            options: [
                {
                    name: 'artist',
                    description: 'artisten du leter etter. Er ikke case sensitiv, men må skrives helt korrekt.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
    ],
}
