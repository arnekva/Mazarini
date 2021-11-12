import { Message, MessageEmbed } from 'discord.js'
import { spotifyToken } from '../client-env'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { getUsernameInQuotationMarks } from '../utils/textUtils'
import { ICommandElement } from './commands'
import { Music } from './musicCommands'
const request = require('request')
const fetch = require('node-fetch')
export class SpotifyCommands {
    static getUsersCurrentSong(rawMessage: Message, content: string, args: string[]) {
        const user = args[0] ?? undefined

        const url = `https://api.spotify.com/v1/me/player/currently-playing?market=NO`
        request(
            {
                url: url,
                headers: {
                    Authorization: 'Bearer ' + spotifyToken,
                },
                rejectUnauthorized: false,
            },
            function (err: any, res: any) {
                if (err) {
                    rawMessage.reply('Fant ingen Spotify-bruker ved navn <' + user + '>')
                } else {
                    MessageHelper.sendMessage(rawMessage, res)
                }
            }
        )
    }

    static async searchForSongOnSpotifyAPI(artist: string, track: string, message: Message) {
        const baseURL = 'https://api.spotify.com/v1/search'
        const searchString = artist
            .replace(/\s/g, '+')
            .concat('+' + track.replace(/\s/g, '+'))
            .replace(/\-/g, '+')
            .replace(/\;/g, '+')

        const emoji = await EmojiHelper.getEmoji('catJAM', message)
        const res = fetch(baseURL + '?query=' + searchString + '&type=track&offset=0&limit=1', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + spotifyToken,
                'Content-type': 'application/json',
            },
        })
            .then((res: any) => {
                res.json()
                    .then((el: any) => {
                        if (!el?.tracks?.items[0]) {
                            MessageHelper.sendMessage(message, `${artist} - ${track} ${emoji.id} (fant: ${el})`)
                        }
                        const song = new MessageEmbed()
                            .setTitle(`${artist} - ${track}`)
                            .setURL(el?.tracks?.items[0]?.external_urls?.spotify ?? '#')
                            .setDescription(`Release: ${el?.tracks?.items[0].album?.release_date}`)
                        MessageHelper.sendFormattedMessage(message, song)
                    })
                    .catch((error: any) => {
                        MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
                    })
            })
            .catch((error: any) => {
                MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
            })
    }

    static async currentPlayingFromDiscord(rawMessage: Message, content: string, args: string[]) {
        let name = ''
        if (args[0]) {
            name = getUsernameInQuotationMarks(content) ?? args[0]
        } else {
            name = rawMessage.author.username
        }
        const guild = rawMessage.channel.client.guilds.cache.get('340626855990132747')
        const emoji = await EmojiHelper.getEmoji('catJAM', rawMessage)
        if (guild) {
            if (args[0] === 'alle') {
                let replyString = ''
                const users = guild.members.cache.forEach((user) => {
                    if (user && user.presence)
                        user.presence.activities.forEach((activity) => {
                            if (activity.name === 'Spotify') {
                                replyString += `(${user.user.username}) ${activity.state} - ${activity.details} ${emoji.id}\n`
                            }
                        })
                })
                if (replyString.length === 0) replyString = 'Ingen hører på Spotify for øyeblikket'
                await MessageHelper.sendMessage(rawMessage, replyString)
            } else if (args[0] === 'full') {
                const waitMessage = await MessageHelper.sendMessage(rawMessage, 'Henter last.fm data fra brukere... dette kan ta litt tid')
                const users = guild.members.cache.forEach(async (user) => {
                    const lastFmName = DatabaseHelper.getValue('lastFmUsername', user.user.username, rawMessage, true)
                    if (!!lastFmName) {
                        if (waitMessage) {
                            Music.findCommand(waitMessage, content, ['siste', '1', user.user.username], true, undefined, true, true)
                        }
                    }
                })
                if (waitMessage) waitMessage.delete()
            } else {
                const user = guild.members.cache.filter((u) => u.user.username == name).first()
                if (user && user.presence) {
                    let replystring = ''
                    const spotify = user.presence.activities.filter((a) => a.name === 'Spotify')[0]

                    if (spotify) {
                        replystring += `${spotify.state} - ${spotify.details} ${emoji.id}`
                    }

                    if (replystring === '') replystring += `${name} hører ikke på Spotify for øyeblikket`

                    MessageHelper.sendMessage(rawMessage, replystring)?.then((msg) => {
                        if (replystring.includes('hører ikke på Spotify for øyeblikket'))
                            Music.findCommand(msg, content, ['siste', '1', name], true, name, true)
                    })
                } else rawMessage.reply("Fant ingen brukere ved navn '" + name + "'.")
            }
        }
    }

    static readonly currentUserIsPlaying: ICommandElement = {
        commandName: 'spotify',
        description: 'Hent hva brukeren spiller av på Spotify (fra Discord)',
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            SpotifyCommands.currentPlayingFromDiscord(rawMessage, messageContent, args)
        },
        category: 'musikk',
    }
}
