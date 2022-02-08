import { Client, Message, MessageEmbed, TextChannel } from 'discord.js'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { spotifyToken } from '../client-env'
import { ICommandElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { splitUsername } from '../utils/textUtils'
import { Music } from './musicCommands'
const request = require('request')
const fetch = require('node-fetch')
export class SpotifyCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private getUsersCurrentSong(rawMessage: Message, content: string, args: string[]) {
        const user = args[0] ?? undefined

        const url = `https://api.spotify.com/v1/me/player/currently-playing?market=NO`
        const _msg = this.messageHelper
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
                    _msg.sendMessage(rawMessage.channelId, res)
                }
            }
        )
    }

    private async searchForSongOnSpotifyAPI(artist: string, track: string, message: Message) {
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
                            this.messageHelper.sendMessage(message.channelId, `${artist} - ${track} ${emoji.id} (fant: ${el})`)
                        }
                        const song = new MessageEmbed()
                            .setTitle(`${artist} - ${track}`)
                            .setURL(el?.tracks?.items[0]?.external_urls?.spotify ?? '#')
                            .setDescription(`Release: ${el?.tracks?.items[0].album?.release_date}`)
                        this.messageHelper.sendFormattedMessage(message.channel as TextChannel, song)
                    })
                    .catch((error: any) => {
                        this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
                    })
            })
            .catch((error: any) => {
                this.messageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
            })
    }

    private async currentPlayingFromDiscord(rawMessage: Message, content: string, args: string[]) {
        const _music = new Music(this.client, this.messageHelper)
        let name = ''
        if (args[0]) {
            name = splitUsername(args[0])
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
                await this.messageHelper.sendMessage(rawMessage.channelId, replyString)
            } else if (args[0] === 'full') {
                const waitMessage = await this.messageHelper.sendMessage(rawMessage.channelId, 'Henter last.fm data fra brukere')
                let musicRet = ''
                const users = guild.members.cache.map((u) => u.user.username)

                for (let i = 0; i < users.length; i++) {
                    const lastFmName = DatabaseHelper.getValue('lastFmUsername', users[i], rawMessage, true)
                    if (!!lastFmName) {
                        if (waitMessage) {
                            musicRet += await _music.findCommand(waitMessage, content, ['siste', '1', users[i]], true, undefined, true, true, true)
                        }
                    }
                }

                if (waitMessage) waitMessage.edit(musicRet || 'Test')
                else this.messageHelper.sendMessage(rawMessage.channelId, musicRet)
            } else {
                const user = guild.members.cache.filter((u) => u.user.username == name).first()
                if (user && user.presence) {
                    let replystring = ''
                    const spotify = user.presence.activities.filter((a) => a.name === 'Spotify')[0]

                    if (spotify) {
                        replystring += `${spotify.state} - ${spotify.details} ${emoji.id}`
                    }

                    if (replystring === '') replystring += `${name} hører ikke på Spotify for øyeblikket`

                    this.messageHelper.sendMessage(rawMessage.channelId, replystring)?.then((msg) => {
                        if (replystring.includes('hører ikke på Spotify for øyeblikket'))
                            _music.findCommand(msg, content, ['siste', '1', name], true, name, true)
                    })
                } else rawMessage.reply("Fant ingen brukere ved navn '" + name + "'. Bruk username og ikke displayname")
            }
        }
    }

    public getAllCommands(): ICommandElement[] {
        return [
            {
                commandName: 'spotify',
                description: 'Hent hva brukeren spiller av på Spotify (fra Discord)',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.currentPlayingFromDiscord(rawMessage, messageContent, args)
                },
                category: 'musikk',
            },
        ]
    }
}
