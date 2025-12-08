import { ApplicationEmoji, BaseInteraction, Client, GuildEmoji, Message } from 'discord.js'
import { BtnInteraction, ChatInteraction } from '../Abstracts/MazariniInteraction'
import { ArrayUtils } from '../utils/arrayUtils'
import { ServerIds } from '../utils/mentionUtils'
import { UserUtils } from '../utils/userUtils'

export type emojiType = 'kekw_animated' | 'catJAM' | 'eyebrows'
export interface emojiReturnType {
    id: string
    emojiObject?: GuildEmoji | ApplicationEmoji
    urlId?: string | number
}
type emojiObject = {
    name: string
    id: string
}

export type JobStatus = 'success' | 'failed' | 'not sendt'
export class EmojiHelper {
    //FIXME: No reason for this to be async?
    static async getEmoji(emojiType: string, accessPoint: Message | BaseInteraction | Client<boolean>): Promise<emojiReturnType> {
        const ap = accessPoint instanceof Client ? accessPoint : accessPoint.client
        const emojiObj = ap.emojis.cache.find((emoji) => emoji.name == emojiType)
        if (!emojiObj) return { id: '<Fant ikke emojien>' }
        return { id: `<${emojiObj.animated ? 'a' : ''}:${emojiObj.name}:${emojiObj?.id}>`, emojiObject: emojiObj, urlId: emojiObj?.id }
    }

    static getGuildEmoji(emojiType: string, accessPoint: Message | BaseInteraction | Client<boolean>): GuildEmoji {
        const ap = accessPoint instanceof Client ? accessPoint : accessPoint.client
        return ap.emojis.cache.find((emoji) => emoji.name == emojiType)
    }

    static async getApplicationEmoji(emojiType: string, client: Client<boolean>): Promise<emojiReturnType> {
        const appEmojis = await client.application.emojis.fetch()
        const emojiObj = appEmojis.find((emoji) => emoji.name == emojiType)
        if (!emojiObj) return { id: '<Fant ikke emojien>' }
        return { id: `<${emojiObj.animated ? 'a' : ''}:${emojiObj.name}:${emojiObj?.id}>`, emojiObject: emojiObj, urlId: emojiObj?.id }
    }

    static getHelgEmoji(accessPoint: Message | BaseInteraction | Client<boolean>, isGeggi?: boolean) {
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

    static async createProfileEmoji(interaction: ChatInteraction | BtnInteraction) {
        const profilePic = UserUtils.findUserById(interaction.user.id, interaction).displayAvatarURL()
        await interaction.client.guilds.cache.get(ServerIds.MAZARINI_DEV_2).emojis.create({ attachment: profilePic, name: interaction.user.username })
    }
}
