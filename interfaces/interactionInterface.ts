import { AutocompleteInteraction } from 'discord.js'
import { BtnInteraction, ChatInteraction, ModalInteraction, SelectStringInteraction } from '../Abstracts/MazariniInteraction'

export interface IInteractionCommand<T> {
    /** Name of command */
    commandName: string
    /** Callback to run when command is triggered */
    command: (rawInteraction: T) => void
    /** If options have autocomplete, this callback will handle them */
    autoCompleteCallback?: (rawInteraction: AutocompleteInteraction) => void
    /** If true, the production bot will not trigger this command */
    disabled?: boolean
}

export interface IInteractionElement {
    /** Holds the list over all available commands */
    commands: {
        /** All interactions triggered by a chat input, i.e. slash commands */
        interactionCommands?: IInteractionCommand<ChatInteraction>[]
        /** All interactions triggered by a button press */
        buttonInteractionComands?: IInteractionCommand<BtnInteraction>[]
        /** All interactions triggered by a select menu (dropdown) */
        selectMenuInteractionCommands?: IInteractionCommand<SelectStringInteraction>[]
        /** ALl interactions triggered by a modal dialog */
        modalInteractionCommands?: IInteractionCommand<ModalInteraction>[]
    }
}

/**
 *  This interface is used to define the different timed events that can be run by the bot.
 * It is used in the JobScheduler class to run the different events at the specified intervals.
 * @interface IOnTimedEvent
 * @property {(() => boolean | Promise<boolean>)[]} [weekly] - An array of functions that will be run weekly - 05:00 on Mondays.
 * @property {(() => boolean | Promise<boolean>)[]} [daily] - An array of functions that will be run daily - 05:01 every day.
 * @property {(() => boolean | Promise<boolean>)[]} [hourly] - An array of functions that will be run hourly - xx:01 every hour.
 */
export interface IOnTimedEvent {
    weekly?: (() => boolean | Promise<boolean>)[]
    daily?: (() => boolean | Promise<boolean>)[]
    hourly?: (() => boolean | Promise<boolean>)[]
}
