import { Client, Message } from 'discord.js'
import { Headers } from 'node-fetch'
import { URLSearchParams } from 'url'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { spotifyClientID, spotifyClientSecret } from '../client-env'
import { ICommandElement } from '../General/commands'
import { DatabaseHelper } from '../helpers/databaseHelper'
import { EmojiHelper } from '../helpers/emojiHelper'
import { MessageHelper } from '../helpers/messageHelper'
import { splitUsername } from '../utils/textUtils'
import { Music } from './musicCommands'
const SpotifyWebApi = require('spotify-web-api-node')
const base64 = require('base-64')
const request = require('request')
const fetch = require('node-fetch')
export class SpotifyCommands extends AbstractCommands {
    constructor(client: Client, messageHelper: MessageHelper) {
        super(client, messageHelper)
    }

    private getUsersCurrentSong(rawMessage: Message, content: string, args: string[]) {
        const user = args[0] ?? undefined

        const url = `https://api.spotify.com/v1/search?type=track&include_external=audio`
        const _msg = this.messageHelper
        request(
            {
                url: url,
                headers: {
                    Authorization: 'Bearer ' + spotifyClientID,
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

    /** Autorisere appen hos spotify
     *  @returns Access Token for API-et
     */
    private async authorize() {
        let myHeaders = new Headers()
        myHeaders.append('Authorization', `Basic ${base64.encode(spotifyClientID + ':' + spotifyClientSecret)}`)
        myHeaders.append('Content-Type', 'application/x-www-form-urlencoded')

        var urlencoded = new URLSearchParams()
        urlencoded.append('grant_type', 'client_credentials')

        const requestOptions = {
            method: 'POST',
            headers: myHeaders,
            body: urlencoded,
            redirect: 'follow',
        }

        let res = await fetch('https://accounts.spotify.com/api/token', requestOptions)
        res = await res.json()
        return res.access_token
    }

    private async searchForSongOnSpotifyAPI(message: Message, messageContent: string, args: string[], wantURLinReturn?: boolean) {
        const _msgHelper = this.messageHelper
        const auth = await this.authorize() //Autoriser appen
        const spotifyApi = new SpotifyWebApi({
            clientId: spotifyClientID,
            clientSecret: spotifyClientSecret,
            redirectUri: 'http://www.example.com/callback',
        })
        spotifyApi.setAccessToken(auth)

        const trackName = messageContent

        const cleanTrackname = (tn: string) => {
            let cleanString = ''
            if (tn.includes(';')) {
                cleanString += tn.slice(0, tn.indexOf(';'))
            }
            cleanString += tn.slice(tn.indexOf('-'))
            cleanString.replace('-', '')
            return cleanString
        }
        const data = await spotifyApi.searchTracks(cleanTrackname(trackName))

        if (data) {
            const firstResult = data.body.tracks.items[0]

            const result = `${firstResult?.name} av ${firstResult?.artists[0]?.name}. Utgitt ${firstResult?.album?.release_date}. ${firstResult?.external_urls?.spotify}`
            if (wantURLinReturn && firstResult) return firstResult?.external_urls.spotify
            else _msgHelper.sendMessage(message.channelId, result)
        }
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
                        replystring += `${spotify?.state} - ${spotify?.details} ${emoji.id}`
                    }
                    if (spotify?.state) {
                        replystring += await this.searchForSongOnSpotifyAPI(rawMessage, `${spotify.state} - ${spotify.details}`, [], true)
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
            {
                commandName: 'sang',
                description: 'Søk etter en sang på Spotify. Returnerer første resultat med link',
                command: (rawMessage: Message, messageContent: string, args: string[]) => {
                    this.searchForSongOnSpotifyAPI(rawMessage, messageContent, args)
                },
                category: 'musikk',
            },
        ]
    }
}
