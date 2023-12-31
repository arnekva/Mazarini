import { ApplicationCommandOptionType } from "discord.js";
import { ISlashCommandItem } from "../commandBuilder";

export const sendCommand: ISlashCommandItem = {
    commandName: 'send',
    commandDescription: 'Send en melding som Høie',
    options: [
        {
            name: 'id',
            description: 'velg meme du skal lage',
            type: ApplicationCommandOptionType.String,
            required: true,
            autocomplete: true
        },]
}
