import { CacheType, ChatInputCommandInteraction, EmbedBuilder, Interaction, Message, User } from 'discord.js'
import { Headers } from 'node-fetch'
import { URLSearchParams } from 'url'
import { AbstractCommands } from '../Abstracts/AbstractCommand'
import { spotifyClientID, spotifyClientSecret } from '../client-env'
import { MazariniClient } from '../client/MazariniClient'
import { IInteractionElement } from '../general/commands'
import { EmojiHelper } from '../helpers/emojiHelper'
import { EmbedUtils } from '../utils/embedUtils'
import { UserUtils } from '../utils/userUtils'
import { Music } from './musicCommands'
const SpotifyWebApi = require('spotify-web-api-node')
const base64 = require('base-64')
const request = require('request')
const fetch = require('node-fetch')
export class SpotifyCommands extends AbstractCommands {
    constructor(client: MazariniClient) {
        super(client)
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

    /** Authorize app
     *  @returns Access Token for API
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

    cleanSearchString(s: string) {
        let cleanString = s
        if (s.includes(';')) {
            cleanString += cleanString.slice(0, cleanString.indexOf(';'))
        }
        cleanString = cleanString.replace(' -', '')
        return cleanString
    }

    private async searchForSongOnSpotifyAPI(track: string, artist?: string) {
        const _msgHelper = this.messageHelper
        const auth = await this.authorize() //Autoriser appen
        const spotifyApi = new SpotifyWebApi({
            clientId: spotifyClientID,
            clientSecret: spotifyClientSecret,
            redirectUri: 'http://www.example.com/callback',
        })
        spotifyApi.setAccessToken(auth)

        const searchString = artist ? `${track} ${artist}` : track

        return await spotifyApi.searchTracks(searchString)
    }

    private async printSongFromSpotify(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply()
        let searchStringTrack = interaction.options.get('track')?.value as string
        let searchStringArtist = interaction.options.get('artist')?.value as string
        let searchString = `${searchStringArtist} ${searchStringTrack}`
        let debugMode = false
        if (searchString.includes('debug')) {
            searchString = searchString.replace('debug', '')
            debugMode = true
        }

        const data = await this.searchForSongOnSpotifyAPI(searchString)

        if (data) {
            const firstResult = data.body.tracks.items[0]

            const result = `${firstResult?.name} av ${firstResult?.artists[0]?.name}. Utgitt ${firstResult?.album?.release_date}. ${
                firstResult?.external_urls?.spotify
            } ${
                debugMode
                    ? '\n*DEBUG*: Funnet med søk på ' +
                      searchString +
                      ' Andre resultat var ' +
                      data?.body?.tracks?.items[1]?.name +
                      ' av ' +
                      data?.body?.tracks?.items[1]?.artists[0].name
                    : ''
            }`
            this.messageHelper.replyToInteraction(interaction, result, { hasBeenDefered: true })
        }
    }

    private async currentPlayingFromDiscord(
        interaction: Interaction<CacheType>,
        mode?: string,
        user?: User,
        includeLyrics?: boolean
    ): Promise<string | EmbedBuilder> {
        const _music = new Music(this.client)

        const isAllActive = mode === 'active'
        const isFull = mode === 'full'
        const emoji = await EmojiHelper.getEmoji('catJAM', interaction)
        if (isAllActive) {
            const emb = EmbedUtils.createSimpleEmbed(`🎶 Musikk 🎶`, `Aktive nå`)

            interaction?.guild?.members?.cache?.forEach((localMember) => {
                if (localMember?.presence)
                    localMember.presence.activities.forEach((activity) => {
                        if (activity.name === 'Spotify' && activity.state) {
                            emb.addFields({
                                name: `${localMember.user.username}`,
                                value: `${activity.state} - ${activity.details} ${emoji?.id ?? ''}`,
                            })
                        }
                    })
            })

            if (emb.data.fields.length === 0) return 'Ingen hører på Spotify for øyeblikket'
            return emb
        }

        if (isFull) {
            let musicRet: string | EmbedBuilder
            const users = interaction?.guild?.members?.cache.map((u) => {
                return {
                    id: u.user.id,
                    name: u.user.username,
                }
            })
            if (users) {
                const emb = EmbedUtils.createSimpleEmbed(`🎶 Musikk 🎶`, 'Fra alle')
                for (let i = 0; i < users.length; i++) {
                    const user = await this.client.db.getUser(users[i].id)
                    const lastFmName = user?.lastFMUsername

                    if (lastFmName) {
                        const data = await _music.findLastFmData({
                            user: lastFmName,
                            includeNameInOutput: true,
                            includeStats: false,
                            limit: '1',
                            method: { cmd: _music.getCommand('siste', '1'), desc: 'Siste 1' },
                            silent: false,
                            username: users[i].name,
                            header: '',
                        })
                        const dataToUse = data[0]
                        const datePlayed = dataToUse.datePlayed ? dataToUse.datePlayed : ''
                        emb.addFields({
                            name: dataToUse.username,
                            value: `${dataToUse.artist} - ${dataToUse.track}  *${dataToUse.isCurrentlyPlaying ? '(spiller nå)' : datePlayed}*`,
                        })
                    }
                }
                // if (musicRet.length < 1) musicRet = 'Fant ingen data'
                return emb
            } else return 'Ingen data funnet'
        }

        const member = UserUtils.findMemberByUserID(user ? user.id : interaction.user.id, interaction)
        if (member && member.presence && member.presence.activities.find((a) => a.name === 'Spotify')) {
            const spotify = member.presence.activities.find((a) => a.name === 'Spotify')
            const spotifyImageBaseUrl = `https://i.scdn.co/image`
            if (spotify?.state && spotify.details) {
                const imageUrl = spotify.assets.largeImage.replace('spotify:', '')
                const embed = new EmbedBuilder()
                    .setTitle(`${user ? `${user.username} hører på: ` : ''}${spotify?.details} `)
                    .setDescription(`${spotify?.state}`)

                embed.addFields({ name: 'Album', value: spotify.assets.largeText ?? 'Ukjent album', inline: true })
                if (includeLyrics) {
                    const lyrics = await Music.fetchLyrcs(spotify?.state, spotify?.details)
                    if (lyrics) {
                        embed.addFields({ name: 'Tekst', value: lyrics })
                    } else {
                        embed.setFooter({ text: `Fant ingen tekst for sangen` })
                    }
                }
                if (!!spotify?.url) embed.setURL(spotify.url)
                if (spotify.assets) embed.setThumbnail(`${spotifyImageBaseUrl}/${imageUrl}`)
                return embed
            }
        } else {
            const dbUser = await this.client.db.getUser(user?.id ?? interaction.user.id)
            const lastFmName = dbUser.lastFMUsername
            if (!!lastFmName) {
                const data = await _music.findLastFmData({
                    user: lastFmName,
                    includeNameInOutput: true,
                    includeStats: false,
                    limit: '1',
                    method: { cmd: _music.getCommand('siste', '1'), desc: 'Siste 1' },
                    silent: false,
                    username: lastFmName,
                    header: '',
                })

                const dataToUse = data[0]
                const emb = EmbedUtils.createSimpleEmbed(`🎶 Musikk 🎶`, `${dataToUse?.username}`)
                if (data && dataToUse) {
                    emb.addFields(
                        { name: 'Artist', value: dataToUse.artist ?? 'Mangler data' },
                        { name: 'Sang', value: (dataToUse.track ?? 'Mangler data') + (dataToUse.isCurrentlyPlaying ? ' (spiller nå)' : '') }
                    )
                    emb.setFooter({ text: `Dataen er hentet fra Last.fm` })
                } else {
                    return 'Klarte ikke hente data fra Last.fm'
                }
                return emb
            }
        }
        return `${user ? user : 'Du'} hører ikke på Spotify nå, og har heller ikke koblet til Last.fm`
    }

    private async handleSpotifyInteractions(interaction: ChatInputCommandInteraction<CacheType>) {
        if (interaction) {
            await interaction.deferReply() //Må defere reply siden botter har maks 3 sekund å svare på en interaction
            const mode = interaction.options.get('mode')?.value as string
            const user = interaction.options.get('user')?.user
            const includeLyrics = interaction.options.get('lyrics')?.value as boolean
            const data = await this.currentPlayingFromDiscord(interaction, mode, user instanceof User ? user : undefined, includeLyrics)
            this.messageHelper.replyToInteraction(interaction, data, { hasBeenDefered: true })
        }
    }

    getAllInteractions(): IInteractionElement {
        return {
            commands: {
                interactionCommands: [
                    {
                        commandName: 'spotify',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.handleSpotifyInteractions(rawInteraction)
                        },
                    },
                    {
                        commandName: 'sang',
                        command: (rawInteraction: ChatInputCommandInteraction<CacheType>) => {
                            this.printSongFromSpotify(rawInteraction)
                        },
                    },
                ],
            },
        }
    }
}
