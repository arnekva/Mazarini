import { ApplicationCommandOptionType } from 'discord.js'
import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const deckCommand: ISlashCommandItem = {
    commandName: 'deck',
    commandDescription: 'Administrer CCG deck-ene dine',
    subCommands: [
        {
            commandName: 'set',
            commandDescription: 'Sett din aktive deck',
            options: [
                {
                    name: 'deck',
                    description: 'Navn på decken din',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
            ],
        },
        {
            commandName: 'new',
            commandDescription: 'Lag en ny deck',
            options: [
                {
                    name: 'name',
                    description: 'Navn på decken din',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            commandName: 'edit',
            commandDescription: 'Rediger en av dine eksisterende decks',
            options: [
                {
                    name: 'deck',
                    description: 'Decken du vil redigere',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
            ],
        },
        {
            commandName: 'copy',
            commandDescription: 'Lag en kopi av en av dine decks',
            options: [
                {
                    name: 'deck',
                    description: 'Navn på decken du vil kopiere',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
                {
                    name: 'name',
                    description: 'Navn på den nye decken',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            commandName: 'rename',
            commandDescription: 'Endre navn på en deck',
            options: [
                {
                    name: 'deck',
                    description: 'Decken du vil gi nytt navn til',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
                {
                    name: 'name',
                    description: 'Nytt navn på decken',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            commandName: 'delete',
            commandDescription: 'Slett en deck',
            options: [
                {
                    name: 'deck',
                    description: 'Navn på decken du vil slette',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true,
                },
            ],
        },
    ],
}
