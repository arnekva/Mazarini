import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the admin command */
export const adminCommand: ISlashCommandItem = {
    commandName: 'admin',
    commandDescription: 'Adminkommandoer',
    subCommandGroups: [
        {
            commandName: 'moreorless',
            commandDescription: 'Adminkommandoer for more or less',
            subCommands: [
                {
                    commandName: 'next',
                    commandDescription: 'Tving morgendagens more or less-kategori til å bli en spesifikk kategori',
                    options: [
                        {
                            name: 'slug',
                            description: 'Hvilken kategori skal brukes i morgen?',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                    ],
                },
                {
                    commandName: 'blacklist',
                    commandDescription: 'Blacklist en more or less-kategori for godt',
                    options: [
                        {
                            name: 'slug',
                            description: 'Hvilken kategori skal blacklistes?',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                    ],
                },
                {
                    commandName: 'list',
                    commandDescription: 'List kategorier',
                    options: [
                        {
                            name: 'type',
                            description: 'Hvilken liste vil du se?',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                { name: 'Blacklisted', value: 'blacklisted' },
                                { name: 'Completed (spilt denne runden)', value: 'completed' },
                                { name: 'Remaining (ikke spilt ennå)', value: 'remaining' },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
}
