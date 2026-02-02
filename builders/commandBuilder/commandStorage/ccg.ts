import { ApplicationCommandOptionType } from 'discord.js'
import { Difficulty, Mode } from '../../../commands/ccg/ccgInterface'
import { GameValues } from '../../../general/values'
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
                            name: 'mode',
                            description: 'Velg om du vil spille for shards eller om du bare vil øve',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                {
                                    name: 'Practice (free)',
                                    value: Mode.Practice,
                                },
                                {
                                    name: `Reward (${GameValues.ccg.rewards.entryFee / 1000}K)`,
                                    value: Mode.Reward,
                                },
                            ],
                        },
                        {
                            name: 'difficulty',
                            description: 'Vanskelighetsgrad påvirker blant annet hvilken deck Høie starter med',
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
                    options: [
                        {
                            name: 'innsats',
                            description: 'Vil du spille om chips? Skriv inn innsatsen her',
                            type: ApplicationCommandOptionType.Integer,
                        },
                    ],
                },
            ],
        },
    ],
}
