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
    subCommandGroups: [
        {
            commandName: 'trade',
            commandDescription: 'bytt inn loot for en ny sjanse',
            subCommands: [
                {
                    commandName: 'in',
                    commandDescription: 'bytt inn 3 loot-gjenstander for en re-roll av samme sjeldenhetsgrad',
                    options: [
                        {
                            name: 'item1',
                            description: '{serie}_{navn}_{farge} - f.eks "mazarini_arne_silver"',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item2',
                            description: '{serie}_{navn}_{farge} - f.eks "mazarini_arne_silver"',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item3',
                            description: '{serie}_{navn}_{farge} - f.eks "mazarini_arne_silver"',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                    ],
                },
                {
                    commandName: 'up',
                    commandDescription: 'bytt inn 5 loot-gjenstander for å oppgradere til en gjenstand av neste sjeldenhetsgrad',
                    options: [
                        {
                            name: 'item1',
                            description: '{serie}_{navn}_{farge} - f.eks "mazarini_arne_silver"',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item2',
                            description: '{serie}_{navn}_{farge} - f.eks "mazarini_arne_silver"',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item3',
                            description: '{serie}_{navn}_{farge} - f.eks "mazarini_arne_silver"',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item4',
                            description: '{serie}_{navn}_{farge} - f.eks "mazarini_arne_silver"',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item5',
                            description: '{serie}_{navn}_{farge} - f.eks "mazarini_arne_silver"',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                    ],
                },
            ],
        },
    ],
}
