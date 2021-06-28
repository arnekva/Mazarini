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

    static readonly seeWarningCounterCommand: ICommandElement = {
        commandName: "warnings",
        description: "Se antall advarsler du har",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            User.getWarnings(rawMessage, messageContent, args);
        }
    }
}