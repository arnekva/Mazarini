import { ApplicationCommandOptionChoiceData, ApplicationCommandOptionType } from 'discord.js'
import { memeMap } from '../../../commands/memeCommands'
import { ISlashCommandItem } from '../commandBuilder'

const getMemes = () => {
    let choices: ApplicationCommandOptionChoiceData<string>[] = new Array<ApplicationCommandOptionChoiceData<string>>()
    Array.from(memeMap.values()).slice(0,24).forEach((meme) => {
        choices.push({name: `${meme.name} (${meme.numberOfBoxes})`, value: meme.id})
    })
    return choices
}

/** Saved version of the Meme command */
export const memeCommand: ISlashCommandItem = {
    commandName: 'meme',
    commandDescription: 'lag et meme',
    options: [
        {
            name: 'meme',
            description: 'velg meme du skal lage',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: getMemes(),
        },
        {
            name: 'tekst-1',
            description: 'tekst 1',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'tekst-2',
            description: 'tekst 2',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'tekst-3',
            description: 'tekst 3',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: 'tekst-4',
            description: 'tekst 4',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
    ],
}

