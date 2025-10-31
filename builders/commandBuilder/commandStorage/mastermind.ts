import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the countdown command */
export const mastermind: ISlashCommandItem = {
    commandName: 'mastermind',
    commandDescription: 'Et spill som handler om å gjette fargekoden',
    subCommands: [
        {
            commandName: 'spill',
            commandDescription: 'Spill dagens mastermind',
        },
    ],
}
