import { CacheType, Client, GuildEmoji, Interaction, Message } from 'discord.js'
import { ArrayUtils } from '../utils/arrayUtils'

export type emojiType = 'kekw_animated' | 'catJAM' | 'eyebrows'
export interface emojiReturnType {
    id: string
    emojiObject?: GuildEmoji
    urlId?: string | number
}
type emojiObject = {
    name: string
    id: string
}
export class EmojiHelper {
    static async getEmoji(emojiType: string, accessPoint: Message | Interaction<CacheType> | Client<boolean>): Promise<emojiReturnType> {
        const ap = accessPoint instanceof Client ? accessPoint : accessPoint.client
        const emojiObj = ap.emojis.cache.find((emoji) => emoji.name == emojiType)
        if (!emojiObj) return { id: '<Fant ikke emojien>' }
        return { id: `<${emojiObj.animated ? 'a' : ''}:${emojiObj.name}:${emojiObj?.id}>`, emojiObject: emojiObj, urlId: emojiObj?.id }
    }

    static getHelgEmoji(accessPoint: Message | Interaction<CacheType> | Client<boolean>, isGeggi?: boolean) {
        const ap = accessPoint instanceof Client ? accessPoint : accessPoint.client
        const emojis = Array.from(ap.emojis.cache.filter((emoji) => emoji.name.includes(isGeggi ? 'geggiexcited' : 'catmygling')))
        const emoji = ArrayUtils.randomChoiceFromArray(emojis)
        return emoji[1]
    }
}
