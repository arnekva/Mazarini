import { Message } from "discord.js";
import { DatabaseHelper } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { countdownTime, dateRegex, DateUtils } from "../utils/dateUtils";
import { ICommandElement } from "./commands";

export class DateCommands {

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
    /**
   * 
   * @param dateObj Date object
   * @param textEnding Det som skal stå etter tiden (eks 1 dag 1 time <text ending> - 1 dag og 1 time 'igjen til ferie')
   * @param finishedText Det som printes hvis datoen/tiden har passert
   */
    static formatCountdownText(dateObj: countdownTime | undefined, textEnding: string, finishedText?: string) {
        if (!dateObj)
            return finishedText ?? "";
        const timeTab: string[] = [];
        let timeString = "Det er";

        if (dateObj.days > 0)
            timeTab.push(" " + dateObj.days + " dager")
        if (dateObj.hours > 0)
            timeTab.push(" " + dateObj.hours + " timer");
        if (dateObj.minutes > 0)
            timeTab.push(" " + dateObj.minutes + " minutter");
        if (dateObj.seconds > 0)
            timeTab.push(" " + dateObj.seconds + " sekunder");
        if (timeTab.length < 1)
            return undefined;
        timeTab.forEach((text, index) => {
            timeString += text
            if (index <= timeTab.length - 2 && timeTab.length > 1)
                timeString += (index == timeTab.length - 2 ? " og" : ",");
        })
        timeString += " " + textEnding;
        return timeString;
    }
    static async countdownToDate(message: Message, messageContent: string, args: string[]) {
        if (args[0] == "fjern") {
            DatabaseHelper.deleteCountdownValue(message.author.username)
            return;
        }
        if (args[0] && (!args[1] || !args[2])) {
            message.reply("du mangler beskrivelse eller time (!mz countdown <dd-mm-yyyy> <HH> <beskrivelse>")
            return;
        }

        if (args.length >= 2) {
            //dd-mm-yyyy
            const isLegal = dateRegex.test(args[0])
            if (!isLegal) {
                message.reply("du må formattere datoen ordentlig (dd-mm-yyyy)")
                return;
            }
            const dateParams = args[0].split("-")
            const hrs = args[1]
            const desc = args.slice(2).join(" ");
            const cdDate = new Date(Number(dateParams[2]), Number(dateParams[1]) - 1, Number(dateParams[0]), Number(hrs))
            DatabaseHelper.setCountdownValue(message.author.username, "date", cdDate.toString())
            DatabaseHelper.setCountdownValue(message.author.username, "desc", desc)
        }
        let sendThisText = "";
        if (Object.keys(DatabaseHelper.getAllCountdownValues()).length < 1) {
            message.reply("Det er ingen aktive countdowns")
            return;
        }
        Object.keys(DatabaseHelper.getAllCountdownValues()).forEach((el) => {
            const e = DatabaseHelper.getNonUserValue("countdown", el)
            const daysUntil = DateUtils.getTimeTo(new Date(e.date))
            const text = DateCommands.formatCountdownText(daysUntil, "til " + e.desc);
            sendThisText += `${!!text ? "\n" : ""}` + `${DateCommands.formatCountdownText(daysUntil, "til " + e.desc)}`
        })
        MessageHelper.sendMessage(message, sendThisText)
    }

    static readonly remindMeCommand: ICommandElement = {
        commandName: "remind",
        description: "Sett en varsling. '1d2t3m4s' for varsling om 1 dag, 2 timer, 3 minutt og 4s. Alle delene er valgfrie (Ikke implementert)",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            DateCommands.setReminder(rawMessage, messageContent, args);
        }
    }

    static readonly countdownCommand: ICommandElement = {
        commandName: "countdown",
        description: "Se hvor lenge det er igjen til events (Legg til ny med '!mz countdown <dd-mm-yyyy> <hh> <beskrivelse>",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            DateCommands.countdownToDate(rawMessage, messageContent, args);
        },
    }
}