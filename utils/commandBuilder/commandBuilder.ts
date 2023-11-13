import {
    ApplicationCommandChoicesData,
    ApplicationCommandOptionData,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    Client,
    ContextMenuCommandBuilder,
    SlashCommandBuilder,
    SlashCommandSubcommandBuilder,
} from 'discord.js'
import { CommandStorage } from './commandStorage'

export interface ISlashCommandItem {
    commandName: string
    commandDescription: string
    options?: ApplicationCommandOptionData[]
    subCommands?: Omit<ISlashCommandItem, 'subCommands'>[]
}
export interface IContextMenuCommandItem {
    commandName: string
}

/** Used to create new commands */
export namespace CommandBuilder {
    /** Creates a slash command based on given params
     */
    export const createSlashCommand = (params: ISlashCommandItem, client: Client) => {
        //Use slashcommandbuilder to start a new command
        const scb = new SlashCommandBuilder()
        scb.setName(params.commandName)
        scb.setDescription(params.commandDescription)
        /** Helper function to add options with the given params to the given SlashCommandBuilder */
        const addOptions = (option: ApplicationCommandOptionData, b: SlashCommandBuilder | SlashCommandSubcommandBuilder) => {
            switch (option.type) {
                case ApplicationCommandOptionType.String:
                    const opt = option as ApplicationCommandChoicesData<string>
                    b.addStringOption((a) => {
                        a.setName(opt.name)
                        a.setDescription(opt.description)
                        if (opt.choices) {
                            a.addChoices(...opt.choices)
                        }
                        a.setRequired(!!opt.required)
                        if (opt.autocomplete) a.setAutocomplete(true)
                        return a
                    })
                    break
                case ApplicationCommandOptionType.Number:
                    b.addNumberOption((a) => {
                        a.setName(option.name)
                        a.setDescription(option.description)

                        return a
                    })
                    break
                case ApplicationCommandOptionType.User:
                    b.addUserOption((a) => {
                        a.setName(option.name)
                        a.setDescription(option.description)

                        return a
                    })
                    break
                case ApplicationCommandOptionType.Boolean:
                    b.addBooleanOption((a) => {
                        a.setName(option.name)
                        a.setDescription(option.description)
                        return a
                    })
                    break
            }
        }
        //If any options are supplied, user helper function to add them
        params.options?.forEach((option) => {
            addOptions(option, scb)
        })
        //If any subcommands are supplied, we create a new slashcommandSubcommandBuilder for each one
        params.subCommands?.forEach((subC) => {
            const localSCB = new SlashCommandSubcommandBuilder()
            localSCB.setName(subC.commandName)
            localSCB.setDescription(subC.commandDescription)
            //Subcommands can also have options, so we use the helper function to add the options
            subC.options?.forEach((o) => {
                addOptions(o, localSCB)
            })
            //Finally, add the subcommand to the slash command
            scb.addSubcommand(localSCB)
        })
        //Creates the slash command
        client.application.commands.create(scb)
    }

    /** This command will automatically create all commands listed in it */
    export const createCommands = (client: Client) => {
        // CommandBuilder.deleteCommand('1171558082007007312', client)
        CommandBuilder.createSlashCommand(CommandStorage.MusicCommand, client)
        // CommandBuilder.deleteCommand('997144601146175631', client)
        // CommandBuilder.createContextMenuCommand({ commandName: 'helg' }, client)
    }

    /** This will create a new context menu command. These commands functions almost identical as a ChatInputCommand, and is run by CommandRunner as if it is - but it has a "target" property
     * so that you can identify which message/user the rightclick was triggered on.
     */
    export const createContextMenuCommand = (params: IContextMenuCommandItem, client: Client) => {
        const data = new ContextMenuCommandBuilder().setName(params.commandName).setType(ApplicationCommandType.Message)
        client.application.commands.create(data)
    }

    /** Deletes a command with the given id
     * To find the ID, use the command in a channel an log the interaction.commandId
     */
    export const deleteCommand = (commandId: string, client: Client) => {
        client.application.commands.delete(commandId)
    }
}
