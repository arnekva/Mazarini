import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the countdown command */
export const moreorless: ISlashCommandItem = {
    commandName: 'moreorless',
    commandDescription: 'Et spill som handler om å gjette mer eller mindre',
    subCommands: [
        {
            commandName: 'spill',
            commandDescription: 'Spill dagens more or less',
        },
        {
            commandName: 'resultater',
            commandDescription: 'vis dagens resultater',
        },
    ],
}
