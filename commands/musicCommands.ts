import { Message } from "discord.js";
import { discordSecret } from "../client-env";
import { DatabaseHelper } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { ICommandElement } from "./commands";
const fetch = require("node-fetch");
export type musicCommand = "user" | "top10" | "top50" | "topalbum" | "topsong" | "topartist" | "top";

interface musicMethod {
    method: string;
    title: string;
    cmdId: string;
}

export const methods: musicMethod[] = [
    { title: "Topp 10 artister", method: "user.gettopartists", cmdId: "top10" }
]

export class Music {
    static readonly baseUrl = "http://ws.audioscrobbler.com/2.0/";
    static findCommand(message: Message, content: string, args: string[]) {
        const method = methods.filter(e => e.cmdId == args[0])[0].method;
        switch (args[0]) {
            case "user":
                if (args[1] && args[2]) {
                    if (args[1] !== message.author.username) {
                        message.reply("du kan kun knytte ditt eget brukernavn")
                        return;
                    }
                    Music.connectLastFmUsernameToUser(args[1], args[2], message)
                    message.reply("Knyttet bruker " + args[1] + " til Last.fm brukernavnet " + args[2]);
                } else {
                    message.reply("formattering skal være '!mz music user DISCORDNAVN LAST.FMNAVN")
                }
                break;
            case "top10":
                Music.findLastFmData(message, message.author.username, method)
                break;
            default:
                break;
        }
    }

    static async findLastFmData(message: Message, discordUsername: string, methodP: string) {
        const msg = await MessageHelper.sendMessage(message, "Laster data...")
        const apiKey = "ce5cbfa8594fd12020e9fcfefff30f14"
        const username = Music.getLastFMUsernameByDiscordUsername(discordUsername, message);
        if (!username) {
            message.reply("du må registrere last.fm brukernavnet ditt først med '!mz music user <discordNavn> <lastFm navn>'")
            return;
        }
        const method = methodP;
        let artistString = "Topp 10 artister:";
        fetch(Music.baseUrl + `?method=${method}&user=${username}&api_key=${apiKey}&format=json&limit=10`, {
            method: "GET",
        }).then((res: any) => {
            res.json().then((data: any) => {
                data.topartists.artist.forEach((element: { name: string; playcount: string; }) => {
                    artistString += `\n${element.name}: ${element.playcount}`
                    // console.log(element.name + ": " + element.playcount);

                });
                // console.log(data.topartists.artist);
                if (msg)
                    msg.edit(artistString)
                else
                    MessageHelper.sendMessage(message, artistString);
            });


        }).catch((error: any) => console.log(error));

    }

    static getLastFMUsernameByDiscordUsername(username: string, rawMessage: Message) {
        return DatabaseHelper.getValue("lastFmUsername", username, rawMessage, true);
    }
    static connectLastFmUsernameToUser(username: string, lfUsername: string, rawMessage: Message) {
        return DatabaseHelper.setValue("lastFmUsername", username, lfUsername)
    }


    static readonly musicCommands: ICommandElement = {
        commandName: "music",
        description: "'User': Sett bruker\n'Top10': Topp 10 artister\n'topalbum': Top 10 album\n'topsong': Topp 10 sanger\n'top': Topp 10 artister",
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            Music.findCommand(rawMessage, messageContent, args);
        }
    }
}