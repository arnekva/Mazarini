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
                    name: 'chips',
                    description: 'hvor mye chips skal brukeren få?',
                    type: ApplicationCommandOptionType.Integer,
                    required: true,
                },
                {
                    name: 'reason',
                    description: 'begrunnelse',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: 'user',
                    description: 'hvem skal få rewarden?',
                    type: ApplicationCommandOptionType.User,
                },
            ],
        },
        {
            commandName: 'lootbox',
            commandDescription: 'Gi en lootbox-reward',
            options: [
                {
                    name: 'quality',
                    description: 'hvilken lootbox skal brukeren få?',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
                {
                    name: 'reason',
                    description: 'begrunnelse',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: 'user',
                    description: 'hvem skal få rewarden?',
                    type: ApplicationCommandOptionType.User,
                },
                {
                    name: 'series',
                    description: 'hvilken serie skal brukeren få lootbox fra?',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                },
            ],
        },
        {
            commandName: 'chest',
            commandDescription: 'Gi en loot chest',
            options: [
                {
                    name: 'quality',
                    description: 'hvilken loot chest skal brukeren få?',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
                {
                    name: 'reason',
                    description: 'begrunnelse',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: 'user',
                    description: 'hvem skal få rewarden?',
                    type: ApplicationCommandOptionType.User,
                },
                {
                    name: 'series',
                    description: 'hvilken serie skal brukeren få lootbox fra?',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                },
            ],
        },
        {
            commandName: 'dealornodeal',
            commandDescription: 'Gi en runde deal or no deal',
            options: [
                {
                    name: 'quality',
                    description: 'hvilket nivå skal brukeren få?',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
                {
                    name: 'reason',
                    description: 'begrunnelse',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: 'user',
                    description: 'hvem skal få rewarden?',
                    type: ApplicationCommandOptionType.User,
                },
            ],
        },
    ],
}
