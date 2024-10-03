import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const lootboxCommand: ISlashCommandItem = {
    commandName: 'loot',
    commandDescription: 'Loot commands',
    permissions: 0,
    subCommands: [
        {
            commandName: 'box',
            commandDescription: 'Kjøp en lootbox',
            options: [
                {
                    name: 'quality',
                    description: 'hvilken kategori av statistikk vil du se - default alle',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: 'Basic 5K', value: 'basic' },
                        { name: 'Premium 20K', value: 'premium' },
                        { name: 'Elite 50K', value: 'elite' },
                    ],
                },
                {
                    name: 'series',
                    description: 'hvilken loot-serie ønsker du å kjøpe fra',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true
                },
            ],
        },
        {
            commandName: 'inventory',
            commandDescription: 'Se en oversikt over loot-en din',
            options: [
                {
                    name: 'series',
                    description: 'hvilken loot-serie ønsker du å se oversikten til?',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true
                },
            ],
        },
    ],
    // subCommandGroups: [
    //     {
    //         commandName: 'trade',
    //         commandDescription: 'bytt inn loot-en din for en ny sjanse',
    //         subCommands: [
    //             {
    //                 commandName: 'in',
    //                 commandDescription: 'bytt inn 3 loot-gjenstander for en re-roll av samme sjeldenhetsgrad',
    //                 options: [
    //                     {
    //                         name: 'series',
    //                         description: 'hvilken loot-serie ønsker du å se oversikten til?',
    //                         type: ApplicationCommandOptionType.String,
    //                         autocomplete: true
    //                     },
    //                     {
    //                         name: 'item1',
    //                         description: 'emojien du vil se statistikk for',
    //                         type: ApplicationCommandOptionType.String,
    //                         required: true,
    //                         autocomplete: true,
    //                     },
    //                     {
    //                         name: 'item2',
    //                         description: 'emojien du vil se statistikk for',
    //                         type: ApplicationCommandOptionType.String,
    //                         required: true,
    //                         autocomplete: true,
    //                     },
    //                     {
    //                         name: 'item3',
    //                         description: 'emojien du vil se statistikk for',
    //                         type: ApplicationCommandOptionType.String,
    //                         required: true,
    //                         autocomplete: true,
    //                     },
    //                 ],
    //             },
    //             {
    //                 commandName: 'up',
    //                 commandDescription: 'Hent stats for de mest/minst brukte emojiene',
    //                 options: [
    //                     {
    //                         name: 'data',
    //                         description: 'Angi om den skal hente de mest eller minst brukte',
    //                         type: ApplicationCommandOptionType.String,
    //                         required: true,
    //                         choices: [
    //                             { name: 'topp', value: 'top' },
    //                             { name: 'bunn', value: 'bottom' },
    //                         ],
    //                     },
    //                     {
    //                         name: 'antall',
    //                         description: 'default 9',
    //                         type: ApplicationCommandOptionType.Integer,
    //                     },
    //                     {
    //                         name: 'type',
    //                         description: 'Default sjekkes både animerte og ikke animerte',
    //                         type: ApplicationCommandOptionType.String,
    //                         choices: [
    //                             { name: 'standard', value: 'standard' },
    //                             { name: 'animert', value: 'animert' },
    //                             { name: 'alle', value: 'alle' },
    //                         ],
    //                     },
    //                     {
    //                         name: 'sortering',
    //                         description: 'Angi hvilken statistikk de sorteres etter. Default total',
    //                         type: ApplicationCommandOptionType.String,
    //                         choices: [
    //                             { name: 'meldinger', value: 'meldinger' },
    //                             { name: 'reaksjoner', value: 'reaksjoner' },
    //                             { name: 'gjennomsnitt', value: 'gjennomsnitt' },
    //                             { name: 'total', value: 'total' },
    //                         ],
    //                     },
                        
    //                 ],
    //             },
    //         ],
    //     },
    // ],
}
