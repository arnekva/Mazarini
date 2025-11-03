import {
    ApplicationCommandChoicesData,
    ApplicationCommandOptionData,
    ApplicationCommandOptionType,
    ApplicationCommandUserOptionData,
    Client,
    Permissions,
    SlashCommandBuilder,
    SlashCommandSubcommandBuilder,
    SlashCommandSubcommandGroupBuilder,
} from 'discord.js'

export interface ISlashCommandItem {
    /** Command name */
    commandName: string
    /** Description of the command shown to user */
    commandDescription: string
    options?: ApplicationCommandOptionData[]
    /** Subcommand groups. Adds an extra layer of command grouping */
    subCommandGroups?: Omit<ISlashCommandItem, 'subCommandGroups' | 'options'>[]
    /** Subcommands, same setups as a normal command */
    subCommands?: Omit<ISlashCommandItem, 'subCommands' | 'subCommandGroups'>[]
    /** Add a guild id if this command is to be ONLY visible in the guild. Will not be a global command */
    guildId?: string
    permissions?: Permissions | bigint | number | null | undefined
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
        if (params.permissions) scb.setDefaultMemberPermissions(params.permissions)
        /** Helper function to add options with the given params to the given SlashCommandBuilder */
        const addOptions = (option: ApplicationCommandOptionData, b: SlashCommandBuilder | SlashCommandSubcommandBuilder) => {
            switch (option.type) {
                case ApplicationCommandOptionType.String:
                    b.addStringOption((a) => {
                        const opt = option as ApplicationCommandChoicesData<string>
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
                case ApplicationCommandOptionType.Integer:
                    b.addIntegerOption((a) => {
                        const opt = option as ApplicationCommandChoicesData<number>
                        a.setName(option.name)
                        a.setDescription(option.description)
                        if (opt.choices) {
                            a.addChoices(...opt.choices)
                        }
                        a.setRequired(!!opt.required)
                        if (opt.autocomplete) a.setAutocomplete(true)
                        return a
                    })
                    break
                case ApplicationCommandOptionType.User:
                    b.addUserOption((a) => {
                        const opt = option as ApplicationCommandUserOptionData
                        a.setName(option.name)
                        a.setDescription(option.description)
                        a.setRequired(!!opt.required)
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
                case ApplicationCommandOptionType.Attachment:
                    b.addAttachmentOption((a) => {
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
        params.subCommandGroups?.forEach((subGroup) => {
            const localSubGroup = new SlashCommandSubcommandGroupBuilder()
            localSubGroup.setName(subGroup.commandName)
            localSubGroup.setDescription(subGroup.commandDescription)
            subGroup.subCommands?.forEach((subC) => {
                const localSCB = new SlashCommandSubcommandBuilder()

                localSCB.setName(subC.commandName)
                localSCB.setDescription(subC.commandDescription)
                //Subcommands can also have options, so we use the helper function to add the options
                subC.options?.forEach((o) => {
                    addOptions(o, localSCB)
                })
                //Finally, add the subcommand to the slash command
                localSubGroup.addSubcommand(localSCB)
            })
            scb.addSubcommandGroup(localSubGroup)
        })
        //Creates the slash command
        client.application.commands.create(scb, params?.guildId)
    }

    /** This command will automatically create all commands listed in it */
    export const createCommands = (client: Client) => {
        // CommandBuilder.deleteCommand('1356989552941727935', client)
        // CommandBuilder.createSlashCommand(CommandStorage.LootboxCommand, client)
        // CommandBuilder.deleteCommand('1025783112648642701', client)
        // CommandBuilder.createContextMenuCommand({ commandName: 'helg' }, client)
    }

    /** This will create a new context menu command. These commands functions almost identical as a ChatInputCommand, and is run by CommandRunner as if it is - but it has a "target" property
     * so that you can identify which message/user the rightclick was triggered on.
     */
    // export const createContextMenuCommand = (params: IContextMenuCommandItem, client: Client) => {
    //     const data = new ContextMenuCommandBuilder().setName(params.commandName).setType(ApplicationCommandType.Message)
    //     client.application.commands.create(data)
    // }

    export const deleteCommandByName = (cmdName: string, client: Client) => {
        client.application.commands
            .fetch()
            .then((commands) => {
                const cmd = commands.find((c) => c.name === cmdName)
                if (cmd) deleteCommand(cmd.id, client)
            })
            .catch(console.error)
    }

    /** Deletes a command with the given id
     * To find the ID, use the command in a channel an log the interaction.commandId
     */
    export const deleteCommand = (commandId: string, client: Client) => {
        client.application.commands.delete(commandId)
    }
}
