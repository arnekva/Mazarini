import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const testCommand: ISlashCommandItem = {
    commandName: 'test',
    commandDescription: 'Dev commands',
    subCommands: [
        {
            commandName: '-1-',
            commandDescription: 'subcommand 1',
        },
        {
            commandName: '-2-',
            commandDescription: 'subcommand 2',
            options: [
                {
                    name: 'item1',
                    description: 'item1',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: true, 
                },
                {
                    name: 'item2',
                    description: 'item2',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: true
                },
                {
                    name: 'item3',
                    description: 'item3',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: true, 
                },
                {
                    name: 'item4',
                    description: 'item4',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: true
                },
                {
                    name: 'item5',
                    description: 'item5',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: true, 
                },
            ],
        }
    ],
    subCommandGroups: [
        {
            commandName: 'group1',
            commandDescription: 'sub group 1',
            subCommands: [
                {
                    commandName: '-2-',
                    commandDescription: 'group 1 command 1',
                },
            ],
        },
    ],
}
