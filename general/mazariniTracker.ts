import { Message } from 'discord.js'
import { MazariniClient } from '../client/MazariniClient'
import { ServerIds } from '../utils/mentionUtils'

export class MazariniTracker {
    private client: MazariniClient
    emojiRegex = new RegExp(/<(a)?:(\S+):(\d+)>/gi)

    constructor(client: MazariniClient) {
        this.client = client
    }

    public async trackEmojiStats(message: Message) {
        if (true || message.guildId === ServerIds.MAZARINI) {
            this.emojiRegex.lastIndex = 0
            let match
            const emojiNames: string[] = []
            while ((match = this.emojiRegex.exec(message.content))) {
                console.log('has match', match[2], message.guild.emojis.cache)

                if (match && message.guild.emojis.cache.get(match[2])) emojiNames.push(match[1])
            }
            if (emojiNames) this.client.database.updateEmojiMessageCounters(emojiNames)
        }
    }
}
