import { Message } from "discord.js";
import { spotifyToken } from "../client-env"
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

    static readonly currentUserIsPlaying: ICommandElement = {
        commandName: "spotify",
        description: "Hent ut hva brukeren spiller av på Spotify nå. (IKKE IMPLEMENTERT)",
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            SpotifyCommands.getUsersCurrentSong(rawMessage, messageContent, args);
        }
    }
}