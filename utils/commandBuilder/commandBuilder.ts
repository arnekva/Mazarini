import { ApplicationCommandOptionData, ApplicationCommandType, Client, ContextMenuCommandBuilder } from 'discord.js'
import { CommandStorage } from './commandStorage'

export interface ISlashCommandItem {
    commandName: string
    commandDescription: string
    options?: ApplicationCommandOptionData[]
}
export interface IContextMenuCommandItem {
    commandName: string
}

/** Used to create new commands */
export namespace CommandBuilder {
    /** Creates a slash command based on given params
     */
    export const createSlashCommand = (params: ISlashCommandItem, client: Client) => {
        client.application.commands.create({
            name: params.commandName,
            description: params.commandName,
            options: params.options,
            type: ApplicationCommandType.ChatInput,
        })
    }

    /** This command will automatically create all commands listed in it */
    export const createCommands = (client: Client) => {
        CommandBuilder.createSlashCommand(CommandStorage.LyricsCommand, client)
        // CommandBuilder.deleteCommand('1156478926521126973', client)
        // CommandBuilder.deleteCommand('1025552134604861440', client)
        // CommandBuilder.createContextMenuCommand({ commandName: 'helg' }, client)
    }

    /** This will create a new context menu command. These commands functions almost identical as a ChatInputCommand, and is run by CommandRunner as if it is - but it has a "target" property
     * so that you can identify which message/user the rightclick was triggered on.
     */
    export const createContextMenuCommand = (params: IContextMenuCommandItem, client: Client) => {
        const data = new ContextMenuCommandBuilder().setName(params.commandName).setType(ApplicationCommandType.Message)
        client.application.commands.create(data)
    }

    /** Deletes a command with the given id */
    export const deleteCommand = (commandId: string, client: Client) => {
        client.application.commands.delete(commandId)
    }
}
