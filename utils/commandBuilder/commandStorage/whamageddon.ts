import { ISlashCommandItem } from '../commandBuilder'

/** Saved version of the Meme command */
export const whamageddonCommand: ISlashCommandItem = {
    commandName: 'whamageddon',
    commandDescription: 'se scoreboard for whamageddon',
    subCommands: [
        {
            commandName: 'tapt',
            commandDescription: 'Registrer at du tapte whamageddon',
        },
        {
            commandName: 'vis',
            commandDescription: 'Vis status',
        },
    ],
}
