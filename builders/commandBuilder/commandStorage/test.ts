import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const testCommand: ISlashCommandItem = {
    commandName: 'test',
    commandDescription: 'Dev commands',
    // options: [
    //     {
    //         name: '-1-',
    //         description: 'option 1',
    //         type: ApplicationCommandOptionType.String,
    //     },
    //     {
    //         name: '-2-',
    //         description: 'option 2',
    //         type: ApplicationCommandOptionType.String,
    //     },
    // ],
    subCommands: [
        {
            commandName: '-1-',
            commandDescription: 'subcommand 1',
            // options: [
            //     {
            //         name: 'kategori',
            //         description: 'hvilken kategori av statistikk vil du se - default alle',
            //         type: ApplicationCommandOptionType.String,
            //         required: true,
            //         choices: [
            //             { name: 'deathroll', value: 'deathroll' },
            //             { name: 'gambling', value: 'gambling' },
            //             { name: 'rulett', value: 'rulett' },
            //         ],
            //     },
            //     {
            //         name: 'bruker',
            //         description: 'bruker du vil se statistikk for - default deg selv',
            //         type: ApplicationCommandOptionType.User,
            //     },
            // ],
        },
    ],
    subCommandGroups: [
        {
            commandName: 'group1',
            commandDescription: 'sub group 1',
            subCommands: [
                {
                    commandName: '-2-',
                    commandDescription: 'group 1 command 1',
                    // options: [
                    //     {
                    //         name: 'emojinavn',
                    //         description: 'emojien du vil se statistikk for',
                    //         type: ApplicationCommandOptionType.String,
                    //         required: true,
                    //         autocomplete: true,
                    //     },
                    // ],
                },
                // {
                //     commandName: 'toppliste',
                //     commandDescription: 'Hent stats for de mest/minst brukte emojiene',
                //     options: [
                //         {
                //             name: 'data',
                //             description: 'Angi om den skal hente de mest eller minst brukte',
                //             type: ApplicationCommandOptionType.String,
                //             required: true,
                //             choices: [
                //                 { name: 'topp', value: 'top' },
                //                 { name: 'bunn', value: 'bottom' },
                //             ],
                //         },
                //         {
                //             name: 'antall',
                //             description: 'default 9',
                //             type: ApplicationCommandOptionType.Integer,
                //         },
                //         {
                //             name: 'type',
                //             description: 'Default sjekkes både animerte og ikke animerte',
                //             type: ApplicationCommandOptionType.String,
                //             choices: [
                //                 { name: 'standard', value: 'standard' },
                //                 { name: 'animert', value: 'animert' },
                //                 { name: 'alle', value: 'alle' },
                //             ],
                //         },
                //         {
                //             name: 'sortering',
                //             description: 'Angi hvilken statistikk de sorteres etter. Default total',
                //             type: ApplicationCommandOptionType.String,
                //             choices: [
                //                 { name: 'meldinger', value: 'meldinger' },
                //                 { name: 'reaksjoner', value: 'reaksjoner' },
                //                 { name: 'gjennomsnitt', value: 'gjennomsnitt' },
                //                 { name: 'total', value: 'total' },
                //             ],
                //         },
                        
                //     ],
                // },
            ],
        },
    ],
}
