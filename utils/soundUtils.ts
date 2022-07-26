import { AudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, StreamType, VoiceConnectionStatus } from '@discordjs/voice'
import { Client } from 'discord.js'
const discordTTS = require('discord-tts')

interface IVoiceConnectParams {
    channelID: string
    guildID: string
    adapterCreator: any //TODO: Type this
}
export class SoundUtils {
    static speakText(client: Client, text: string) {}

    static stopCurrentSay() {}

    static async connectToVoiceAndSpeak(params: IVoiceConnectParams, text: string) {
        const stream = discordTTS.getVoiceStream(text)
        const audioResource = createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: true, })
        let voiceConnection: any
        let audioPlayer = new AudioPlayer()
        if (!voiceConnection || voiceConnection?.status === VoiceConnectionStatus.Disconnected) {
            voiceConnection = joinVoiceChannel({
                channelId: params.channelID,
                guildId: params.guildID,
                adapterCreator: params.adapterCreator,
            })
            voiceConnection = await entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5_000)
        }
        console.log('mid', voiceConnection.status)

        // if (voiceConnection.status === VoiceConnectionStatus.Ready) {
        console.log('ready?')

        voiceConnection.subscribe(audioPlayer)
        audioPlayer.play(audioResource)
        // }

        // const player = createAudioPlayer()
        // const connection = joinVoiceChannel({
        //     channelId: params.channelID,
        //     guildId: params.guildID,
        //     adapterCreator: params.adapterCreator,
        // }).subscribe(player)
        // player.play(discordTTS.getVoiceStream(text))
    }

    static disconnectFromVoiceChannel(guildID: string) {
        const connection = getVoiceConnection(guildID)
        connection?.destroy()
    }
}
