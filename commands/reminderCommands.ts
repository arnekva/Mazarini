import { Message } from "discord.js";
import { ICommandElement } from "./commands";

export class Reminder {

    static setReminder(message: Message, content: string, args: string[]) {
        // const timeStamp = 
        const time = args[0].split("d");
        //Timer
        if (time.length < 2) {
            console.log("hours");

        } else {
            console.log("days");
        }

        const minutt = args[0].split("m", 1);
        const sekund = args[0].split("s", 1);
        console.log(`${time}`);

    }

    static readonly remindMeCommand: ICommandElement = {
        commandName: "remind",
        description: "Sett en varsling. '1d2t3m4s' for varsling om 1 dag, 2 timer, 3 minutt og 4s. Alle delene er valgfrie (Ikke implementert)",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            Reminder.setReminder(rawMessage, messageContent, args);
        }
    }
}