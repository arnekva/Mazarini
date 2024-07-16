import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Spotify command */
export const blackjackCommand: ISlashCommandItem = {
    commandName: 'blackjack',
    commandDescription: 'spill blackjack',
    subCommands: [
        {
            commandName: 'solo',
            commandDescription: 'spill alene mot Bot Høie',
            options: [
                {
                    name: 'satsing',
                    description: 'hvor mye du vil spille for',
                    type: ApplicationCommandOptionType.Integer,
                    required: true
                },
            ],
        },
        {
            commandName: 'vanlig',
            commandDescription: 'spill med flere',
            options: [
                {
                    name: 'satsing',
                    description: 'hvor mye du vil spille for',
                    type: ApplicationCommandOptionType.Integer,
                    required: true
                },
            ],
        },
    ],
}
