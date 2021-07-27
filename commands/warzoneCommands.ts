
import { Channel, Client, DMChannel, Message, NewsChannel, TextChannel } from "discord.js";
import { mwPw } from "../client-env";
import { MessageHelper } from "../helpers/messageHelper";
import { ICommandElement } from "./commands";
const API = require('call-of-duty-api')();

export class WarzoneCommands {

    static async getBRContent(message: Message, messageContent: string, isWeekly?: boolean) {
        const content = messageContent.split(" ")
        const gamertag = content[0];
        const platform = content[1];
        const bewareMessage = "**OBS!** *Bruker development-versjon av modulen (api@2.0.0-dev). Det kan medføre tregheter og ustabilitet.*\n";
        let sentMessage = await MessageHelper.sendMessage(message, "Logger inn..." + "\n" + bewareMessage)
        try {
            await API.login("arne.kva@gmail.com", mwPw);
        } catch (Error) {
            message.reply("Klarte ikke logge inn")
        }
        let response = "";
        //Fjern denne når modulen er fikset.
        response += bewareMessage;
        if (!sentMessage)
            sentMessage = await MessageHelper.sendMessage(message, "Henter data...")
        else
            await sentMessage.edit("Henter data..." + "\n" + bewareMessage)
        if (isWeekly) {
            response += "Weekly Warzone stats for <" + gamertag + ">";

            try {
                let data = await API.MWweeklystats(gamertag, platform);

                const stats = data.wz.mode.br_all.properties;

                response += "\nKills: " + stats.kills;
                response += "\nDeaths: " + stats.deaths;
                response += "\nK/D Ratio: " + (stats.kdRatio).toFixed(3);
                response += "\nKills per game: " + (stats.killsPerGame).toFixed(3);
                response += "\nDamage Done: " + stats.damageDone;
                response += "\nDamage Taken: " + stats.damageTaken + (stats.damageTaken > stats.damageDone ? " (flaut) " : "");
                response += "\nHeadshots: " + stats.headshots;
                response += "\nWall bangs: " + stats.wallBangs;
                response += "\nAverage Lifetime: " + stats.avgLifeTime.toFixed(3);
                // response += "\nDistance Traveled: " + stats.distanceTraveled;
                response += "\nMunition boxes used: " + stats.objectiveMunitionsBoxTeammateUsed ?? "0";
                response += "\nNo. items bought at store: " + stats.objectiveBrKioskBuy ?? "0";
                response += "\nGulag Deaths: " + stats.gulagDeaths;
                response += "\nGulag Kills: " + stats.gulagKills;
                response += "\nGulag K/D: " + (stats.gulagKills / stats.gulagDeaths).toFixed(3);
                response += "\nTime played (må formaterast): " + stats.timePlayed;
                response += "\nHeadshot percentage: " + stats.headshotPercentage.toFixed(3);
                response += "\nExecutions: " + stats.executions;
                response += "\nMatches Played: " + stats.matchesPlayed;
                response += "\nChests opened: " + stats.objectiveBrCacheOpen;
                response += "\nEnemies down (circle 1, 2, 3, 4, 5): " + (stats.objectiveBrDownEnemyCircle1 ?? "0") + ", " + (stats.objectiveBrDownEnemyCircle2 ?? "0") + ", " + (stats.objectiveBrDownEnemyCircle3 ?? "0") + ", " + (stats.objectiveBrDownEnemyCircle4 ?? "0") + ", " + (stats.objectiveBrDownEnemyCircle5 ?? "0") + " ";
                if (sentMessage)
                    sentMessage.edit(response)
                else
                    MessageHelper.sendMessage(message, response)
            } catch (error) {
                if (sentMessage)
                    sentMessage.edit("Du har ingen statistikk for denne ukå, bro")
                else
                    MessageHelper.sendMessage(message, "Du har ingen statistikk for denne ukå, bro")
            }
            // MessageHelper.sendMessage(message.channel, response)
        } else {

            try {
                let data = await API.MWBattleData(gamertag, platform);
                // console.log(data)
                response += "Battle Royale stats for <" + gamertag + ">:";
                response += "\nWins: " + data.br.wins;
                response += "\nKills: " + data.br.kills;
                response += "\nDeaths: " + data.br.deaths;
                response += "\nK/D Ratio: " + (data.br.kdRatio).toFixed(3);
                response += "\nTop 25: " + data.br.topTwentyFive;
                response += "\nTop 5: " + data.br.topFive;
                response += "\nNumber of Contracts: " + data.br.contracts;
                response += "\nTime Played: " + convertTime(data.br.timePlayed);
                response += "\nGames Played: " + data.br.gamesPlayed;
                if (sentMessage)
                    sentMessage.edit(response)
                else
                    MessageHelper.sendMessage(message, response)
            } catch (error) {
                message.reply(error)
            }

        }
    }
    static async getWeaponContent(message: Message, messageContent: string, isWeekly?: boolean) {
        //Smurf account
        const content = messageContent.split(" ")
        const gamertag = content[0];
        const platform = content[1];
        const weapon = content[2];


        try {
            await API.login("arne.kva@gmail.com", "Mazarini332");
        } catch (error) {
            message.reply("Klarte ikke logge inn")
        }

        try {
            let data = API.MWwzstats(gamertag, platform).then((response: any) => {
                const weapons = response.lifetime.itemData;
                let maindata;
            }).catch((error: any) => {
                MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error);
            })
                ;
            // console.log(data)
            let responseString = "Battle Royale stats for <" + gamertag + ">:";


            // MessageHelper.sendMessage(message.channel, responseString)
        } catch (error) {
            MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error);
        }

    }

    static readonly getWZStats: ICommandElement = {
        commandName: "br",
        description: "<gamertag> <plattform> (plattform: 'battle', 'steam', 'psn', 'xbl', 'acti', 'uno' (Activision ID som tall), 'all' (uvisst)",
        command: (rawMessage: Message, messageContent: string) => {
            WarzoneCommands.getBRContent(rawMessage, messageContent);
        },
        category: "gaming",
    }
    static readonly getWeeklyWZStats: ICommandElement = {
        commandName: "weekly",
        description: "<gamertag> <plattform> (plattform: 'battle', 'steam', 'psn', 'xbl', 'acti', 'uno' (Activision ID som tall), 'all' (uvisst)",
        command: (rawMessage: Message, messageContent: string) => {
            WarzoneCommands.getBRContent(rawMessage, messageContent, true);
        },
        category: "gaming",
    }
    static readonly getWeaponStats: ICommandElement = {
        commandName: "weapon",
        description: "<gamertag> <plattform> (plattform: 'battle', 'steam', 'psn', 'xbl', 'acti', 'uno' (Activision ID som tall), 'all' (uvisst)",
        command: (rawMessage: Message, messageContent: string) => {
            WarzoneCommands.getWeaponContent(rawMessage, messageContent);
        },
        category: "gaming",
    }

}

function convertTime(seconds: number) {
    let days = Math.floor(seconds / 86400);
    let remainingSeconds = seconds % 86400;
    let hours = Math.floor(remainingSeconds / 3600);
    let remainingSeconds2 = remainingSeconds % 3600;
    let minutes = Math.floor(remainingSeconds2 / 60);
    let timeString = days + "D " + hours + "H " + minutes + "M"
    return timeString;
}

function getMode(mode: string) {
    let gameMode = "";
    switch (mode) {
        case "br":
        case "battleroyale":
        case "battle":
            gameMode = "br";
            break;

        case "pl":
        case "plunder":
            gameMode = "plunder";
            break;

        case "mr":
        case "mini":
            gameMode = "mini";
            break;

        case "resurgence":
        case "rebirth":
        case "rs":
            gameMode = "resurgence";
            break;
        default:
            gameMode = "ugyldig";
            return gameMode;

    }
}