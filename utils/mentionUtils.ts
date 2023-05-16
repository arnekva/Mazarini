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

    static mentionBotSupport() {
        return roleMention(this.ROLE_IDs.BOT_SUPPORT)
    }

    static CHANNEL_IDs = {
        LAS_VEGAS: '808992127249678386',
        BOT_UTVIKLING: '802716150484041751',
        GENERAL: '340626855990132747',
        ACTION_LOG: '810832760364859432',
        GODMODE: '778599907933159434',
        STATS_SPAM: '967847736693108736',
        VINMONOPOLET: '936685813813628949',
        LOKAL_BOT_SPAM: '880493116648456222',
        LOKAL_BOT_SPAM_DEV: '1106130420308922378',
        GIT_UPDATES: '1107961906028888114',
        BOARD_UPDATES: '1106126900671303711',
        PATCH_NOTES: '1107973457909649418',
    }

    static ROLE_IDs = {
        BOT_SUPPORT: '863038817794392106',
        NATO: '963396965947801630',
        WARZONE: '1034860501383004161',
    }

    static User_IDs = {
        BOT_HOIE: '802945796457758760',
    }
}
