import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    CacheType,
    ButtonInteraction,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
} from 'discord.js'

export interface IInteractionCommand<T> {
    /** Name of command */
    commandName: string
    /** Callback to run when command is triggered */
    command: (rawInteraction: T) => void
    /** If options have autocomplete, this callback will handle them */
    autoCompleteCallback?: (rawInteraction: AutocompleteInteraction) => void
}

export interface IInteractionElement {
    /** Holds the list over all available commands */
    commands: {
        /** All interactions triggered by a chat input, i.e. slash commands */
        interactionCommands?: IInteractionCommand<ChatInputCommandInteraction<CacheType>>[]
        /** All interactions triggered by a button press */
        buttonInteractionComands?: IInteractionCommand<ButtonInteraction<CacheType>>[]
        /** All interactions triggered by a select menu (dropdown) */
        selectMenuInteractionCommands?: IInteractionCommand<StringSelectMenuInteraction<CacheType>>[]
        /** ALl interactions triggered by a modal dialog */
        modalInteractionCommands?: IInteractionCommand<ModalSubmitInteraction<CacheType>>[]
    }
}
