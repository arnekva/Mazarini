import { getVoiceConnection } from '@discordjs/voice'

const say = require('say')
const { joinVoiceChannel } = require('@discordjs/voice')

interface IVoiceConnectParams {
    channelID: string
    guildID: string
    adapterCreator: any //TODO: Type this
}
export class SoundUtils {
    static speakText(text: string) {
        say.speak(text)
    }

    static stopCurrentSay() {
        say.stop()
    }

    static connectToVoiceAndSpeak(params: IVoiceConnectParams, text: string) {
        const connection = joinVoiceChannel({
            channelId: params.channelID,
            guildId: params.guildID,
            adapterCreator: params.adapterCreator,
        })
        SoundUtils.speakText(text)
    }

    static disconnectFromVoiceChannel(guildID: string) {
        const connection = getVoiceConnection(guildID)
        connection.destroy()
    }
}
