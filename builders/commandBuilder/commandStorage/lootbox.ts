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
                    description: 'hvilken lootbox ønsker du å kjøpe?',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
                {
                    name: 'series',
                    description: 'hvilken loot-serie ønsker du å kjøpe fra',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                },
            ],
        },
        {
            commandName: 'chest',
            commandDescription: 'Kjøp en kiste med 3 loot items du kan velge mellom',
            options: [
                {
                    name: 'quality',
                    description: 'hvilken kiste ønsker du å kjøpe?',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
                {
                    name: 'series',
                    description: 'hvilken loot-serie ønsker du å kjøpe fra',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
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
                    autocomplete: true,
                },
            ],
        },
        {
            commandName: 'art',
            commandDescription: 'Kjøp en ny tilfeldig bakgrunn til inventoryen din',
            options: [
                {
                    name: 'series',
                    description: 'hvilken loot-serie ønsker du å kjøpe bakgrunn til?',
                    type: ApplicationCommandOptionType.String,
                    autocomplete: true,
                    required: true,
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
                            description: 'søk på serie, rarity, navn eller farge',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item2',
                            description: 'søk på navn eller farge',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item3',
                            description: 'søk på navn eller farge',
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
                            description: 'søk på serie, rarity, navn eller farge',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item2',
                            description: 'søk på navn eller farge',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item3',
                            description: 'søk på navn eller farge',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item4',
                            description: 'søk på navn eller farge',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            autocomplete: true,
                        },
                        {
                            name: 'item5',
                            description: 'søk på navn eller farge',
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
