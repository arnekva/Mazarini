import { ApplicationCommandOptionType } from 'discord.js'
import { Difficulty } from '../../../commands/ccg/ccgInterface'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const ccgCommand: ISlashCommandItem = {
    commandName: 'ccg',
    commandDescription: 'Mazarini CCG',
    subCommands: [
        {
            commandName: 'help',
            commandDescription: 'Les dokumentasjon om Mazarini CCG',
        },
    ],
    subCommandGroups: [
        {
            commandName: 'play',
            commandDescription: 'Spill Mazarini CCG',
            subCommands: [
                {
                    commandName: 'bot',
                    commandDescription: 'Start en runde med Mazarini CCG mot Høie',
                    options: [
                        {
                            name: 'difficulty',
                            description: 'Vanskelighetsgrad påvirker hvilken deck Høie starter med',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                {
                                    name: 'Lett',
                                    value: Difficulty.Easy,
                                },
                                {
                                    name: 'Middels',
                                    value: Difficulty.Medium,
                                },
                                {
                                    name: 'Vanskelig',
                                    value: Difficulty.Hard,
                                },
                            ],
                        },
                    ],
                },
                {
                    commandName: 'player',
                    commandDescription: 'Start en runde med Mazarini CCG mot en annen spiller',
                },
            ],
        },
    ],
}
