import { ApplicationCommandOptionType } from 'discord.js'
import { CardSet, Difficulty, Mode } from '../../../commands/ccg/ccgInterface'
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
        {
            commandName: 'stats',
            commandDescription: 'Sjekk CCG stats',
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
                            description: 'Velg spillmodus og kortsett',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                {
                                    name: `Practice (free) – Standard`,
                                    value: `${Mode.Practice}_${CardSet.Standard}`,
                                },
                                {
                                    name: `Practice (free) – Full`,
                                    value: `${Mode.Practice}_${CardSet.Full}`,
                                },
                                {
                                    name: `Reward (${GameValues.ccg.rewards.entryFee / 1000}K) – Standard`,
                                    value: `${Mode.Reward}_${CardSet.Standard}`,
                                },
                                {
                                    name: `Reward (${GameValues.ccg.rewards.entryFee / 1000}K) – Full`,
                                    value: `${Mode.Reward}_${CardSet.Full}`,
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
