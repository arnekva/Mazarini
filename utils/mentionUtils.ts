const { userMention, memberNicknameMention, channelMention, roleMention } = require('@discordjs/builders')

export enum ChannelIds {
    VLADIVOSTOK = '808992127249678386',
    BOT_UTVIKLING = '802716150484041751',
    GENERAL = '340626855990132747',
    ACTION_LOG = '1107958956573347910',
    GODMODE = '778599907933159434',
    STATS_SPAM = '967847736693108736',
    VINMONOPOLET = '936685813813628949',
    LOKAL_BOT_SPAM = '880493116648456222',
    LOCALHOST = '1106130420308922378',
    SECRET_LOCALHOST = '1288081598499262464',
    BOARD_UPDATES = '1106126900671303711',
    PATCH_NOTES = '1107973457909649418',
    GIT_LOG = '1107961906028888114',
    ROCKET_LEAGUE = '938552433158811758',
}

export enum ThreadIds {
    GENERAL_TERNING = '1231880250569261106',
    LOCALHOST_TEST = '1251646425461297332',
    MORE_OR_LESS = '1331898914571292683',
}

export enum ServerIds {
    MAZARINI = '340626855990132747',
    MAZARINI_DEV = '1106124769797091338',
    MAZARINI_DEV_2 = '1106128684882067460',
}

export class MentionUtils {
    /** Automatically creates a mention string from the provided user id */
    static mentionUser(id: string) {
        return userMention(id)
    }
    /** Automatically creates a mention string from the provided role id */

    static mentionRole(id: string) {
        return roleMention(id)
    }
    /** Automatically creates a mention string from the provided channel id */

    static mentionChannel(id: string) {
        return channelMention(id)
    }

    static mentionBotSupport() {
        return roleMention(this.ROLE_IDs.BOT_SUPPORT)
    }

    static ROLE_IDs = {
        BOT_SUPPORT: '863038817794392106',
        NATO: '963396965947801630',
        WARZONE: '1034860501383004161',
    }

    static User_IDs = {
        BOT_HOIE: '802945796457758760',
        CLYDE: '1081004946872352958',
        MAGGI: '221739293889003520',
        GEGGI: '293489109048229888',
        THOMAS: '397429060898390016',
        WORDLE_BOT: '1211781489931452447',
        HENRIK: '715963046861865091',
    }
}
