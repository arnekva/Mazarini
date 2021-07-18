import { Message } from "discord.js";
import { DatabaseHelper } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { ICommandElement } from "./commands";

export class User {

    static getWarnings(message: Message, content: string, args: string[]) {
        const userNameToFind = args.join(" ");
        const userExists = DatabaseHelper.findUserByUsername(userNameToFind, message);
        const warningCounter = DatabaseHelper.getValue("warningCounter", (userExists?.username ?? message.author.username), message)
        if (userExists)
            MessageHelper.sendMessage(message, `${(userExists?.username)} har ${warningCounter} ${Number(warningCounter) === 1 ? "advarsel" : "advarsler"}`)
        else
            MessageHelper.sendMessage(message, `${(message.author.username)} har ${warningCounter} ${Number(warningCounter) === 1 ? "advarsel" : "advarsler"}`)
    }

    static setDatabaseDisplayName(message: Message, content: string, args: string[]) {
        if (!args[0]) {
            message.reply("Du må spesifisere hva displaynavnet ditt skal være")
            return;

        }
        const username = args[0];
        const user = DatabaseHelper.setValue("displayName", message.author.id, username);
        MessageHelper.sendMessage(message, `Opddaterte displaynavnet til ${message.author.username} til ${username}`)
    }

    static readonly seeWarningCounterCommand: ICommandElement = {
        commandName: "warnings",
        description: "Se antall advarsler du har",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            User.getWarnings(rawMessage, messageContent, args);
        }
    }
    static readonly displayNameCommand: ICommandElement = {
        commandName: "displaynavn",
        description: "Sett displaynavnet ditt for botten",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            User.setDatabaseDisplayName(rawMessage, messageContent, args);
        }
    }
}