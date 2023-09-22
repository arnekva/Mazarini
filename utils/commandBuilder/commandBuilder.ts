import { ApplicationCommandOptionData, ApplicationCommandType, Client, ContextMenuCommandBuilder } from 'discord.js'

export interface ISlashCommandItem {
    commandName: string
    commandDescription: string
    options?: ApplicationCommandOptionData[]
}
export interface IContextMenuCommandItem {
    commandName: string
}

export namespace CommandBuilder {
    export const createSlashCommand = (params: ISlashCommandItem, client: Client) => {
        client.application.commands.create({
            name: params.commandName,
            description: params.commandName,
            options: params.options,
            type: ApplicationCommandType.ChatInput,
        })
    }

    /** Let this command run once to create the commands */
    export const createCommands = (client: Client) => {
        // CommandBuilder.createSlashCommand(CommandStorage.MemeCommand, client)
        CommandBuilder.createContextMenuCommand({ commandName: 'helg' }, client)
       
    }

    export const createContextMenuCommand = (params: IContextMenuCommandItem, client: Client) => {
        const data = new ContextMenuCommandBuilder().setName(params.commandName).setType(ApplicationCommandType.User)
        client.application.commands.create(data)
        // client.application.commands.create('1154764952561782875')
    }

    /** Can only delete by command id */
    export const deleteCommand = (commandId: string, client: Client) => {
        client.application.commands.delete(commandId)
    }
}
