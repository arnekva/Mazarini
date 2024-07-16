import { CacheType, ChatInputCommandInteraction, Client, GuildEmoji, Interaction, Message } from 'discord.js'
import { ArrayUtils } from '../utils/arrayUtils'
import { ServerIds } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'

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

export type JobStatus = 'success' | 'failed' | 'not sendt'
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
        const emoji = emojis.length === 1 ? emojis[0] : ArrayUtils.randomChoiceFromArray(emojis)
        return emoji[1]
    }

    static getStatusEmoji(s: JobStatus) {
        switch (s) {
            case 'success':
                return '✅'

            case 'failed':
                return '⛔️'
            case 'not sendt':
                return '☑️'
        }
    }

    static async createProfileEmoji(interaction: ChatInputCommandInteraction<CacheType>) {
        const profilePic = UserUtils.findUserById(interaction.user.id, interaction).displayAvatarURL()
        await interaction.client.guilds.cache.get(ServerIds.MAZARINI_DEV_2).emojis.create({ attachment: profilePic, name: interaction.user.username})
    }
}
