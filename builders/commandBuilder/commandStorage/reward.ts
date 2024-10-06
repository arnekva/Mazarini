import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const rewardCommand: ISlashCommandItem = {
    commandName: 'reward',
    commandDescription: 'Gi en reward',
    subCommands: [
        {
            commandName: 'chips',
            commandDescription: 'Gi en chips-reward',
            options: [
                {
                    name: 'user',
                    description: 'hvem skal få rewarden?',
                    type: ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: 'chips',
                    description: 'hvor mye chips skal brukeren få?',
                    type: ApplicationCommandOptionType.Integer,
                    required: true
                },
                {
                    name: 'reason',
                    description: 'begrunnelse', 
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            commandName: 'lootbox',
            commandDescription: 'Gi en lootbox-reward',
            options: [
                {
                    name: 'user',
                    description: 'hvem skal få rewarden?',
                    type: ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: 'quality',
                    description: 'hvilken lootbox skal brukeren få?',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: 'Basic 5K', value: 'basic' },
                        { name: 'Premium 20K', value: 'premium' },
                        { name: 'Elite 50K', value: 'elite' },
                    ],
                },
                {
                    name: 'reason',
                    description: 'begrunnelse',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },                
            ],
        },
    ],
}
