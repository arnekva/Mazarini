const { userMention, memberNicknameMention, channelMention, roleMention } = require('@discordjs/builders')

export class MentionUtils {
    static mentionUser(id: string) {
        return userMention(id)
    }
    static mentionRole(id: string) {
        return roleMention(id)
    }
    static mentionChannel(id: string) {
        return channelMention(id)
    }
}
