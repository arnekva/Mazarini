import { Message } from "discord.js";
import { spotifyToken } from "../client-env"
import { EmojiHelper } from "../helpers/emojiHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { ICommandElement } from "./commands";
const request = require('request');

export class SpotifyCommands {

    static getUsersCurrentSong(rawMessage: Message, content: string, args: string[]) {

        const user = args[0] ?? undefined;

        const url = `https://api.spotify.com/v1/me/player/currently-playing?market=NO`
        request({
            url: url,
            headers: {
                'Authorization': "Bearer " + spotifyToken
            },
            rejectUnauthorized: false
        }, function (err: any, res: any) {
            if (err) {
                rawMessage.reply("Fant ingen Spotify-bruker ved navn <" + user + ">")
            } else {
                MessageHelper.sendMessage(rawMessage, res);
            }

        });
    }

    static async currentPlayingFromDiscord(rawMessage: Message, content: string, args: string[]) {
        let name = "";
        if (args[0]) {
            name = args[0];

        } else {
            rawMessage.reply("Du må spesifisera brukernavn")
            return;
        }
        const guild = rawMessage.channel.client.guilds.cache.get("340626855990132747");
        if (guild) {
            const user = guild.members.cache.filter(u => u.user.username == name).first();
            if (user) {
                const emoji = await EmojiHelper.getEmoji("catJAM", rawMessage);
                let replystring = "";
                user.presence.activities.forEach((activity) => {
                    if (activity.name === "Spotify") {
                        replystring += `${activity.state} - ${activity.details} ${emoji.id}`;
                    }

                })
                if (replystring === "")
                    replystring += `${name} hører ikke på Spotify for øyeblikket`
                await MessageHelper.sendMessage(rawMessage, replystring)
                // if (user.presence.clientStatus) {
                //     if (user.presence.activities && user.presence.activities[0]) {
                //         const game = user.presence.activities[0].name == "Custom Status" ? user.presence.activities[1] : user.presence.activities[0];
                //         await MessageHelper.sendMessage(message, `${name} e ${user.presence.clientStatus.desktop ? "på pc-en" : (user.presence.clientStatus.mobile ? "på mobilen" : "i nettleseren")} ${game ? "med aktiviteten " + game.name + "." : "uten någe aktivitet."}`)
                //     }
                // }
            }
        }

    }

    static readonly currentUserIsPlaying: ICommandElement = {
        commandName: "spotify",
        description: "Hent hva brukeren spiller av på Spotify (fra Discord)",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            SpotifyCommands.currentPlayingFromDiscord(rawMessage, messageContent, args);
        }
    }
    static readonly currentlyPlayingCommand: ICommandElement = {
        commandName: "spiller",
        description: "Se hva en bruker spiller. <brukernavn>",
        deprecated: "spotify",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            SpotifyCommands.currentPlayingFromDiscord(rawMessage, messageContent, args);
        }
    }
}