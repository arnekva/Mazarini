import { Emoji, GuildEmoji, Message } from "discord.js";

export type emojiType = "kekw_animated" | "catJAM" | "eyebrows";
export interface emojiReturnType {
    id: string;
    emojiObject?: GuildEmoji;
}
export class EmojiHelper {
    static async getEmoji(
        emojiType: string,
        message: Message
    ): Promise<emojiReturnType> {
        const emojiObj = await message.client.emojis.cache.find(emoji => emoji.name == emojiType);
        if (!emojiObj)
            return { id: "<Fant ikke emojien>" }
        return { id: `<${emojiObj.animated ? "a:" : ""}${emojiObj.name}:${emojiObj?.id}>`, emojiObject: emojiObj }
        // message.reply("lmao, commanden '" + command + "' fins ikkje <a:kekw_animated:" + kekw?.id + "> ." + (matched ? " Mente du **" + matched + "**?" : " Prøv !mz help"))
    }

    // export class EmojiHelper {
    // static async getEmoji(emojiName: string, message: Message): Promise<emojiReturnType> {
    //     const emojiObj = await message.client.emojis.cache.find(emoji => emoji.name == emojiName);
    //     if (!emojiObj)
    //         return { id: "<Fant ikke emojien>" }
    //     return { id: `<${emojiObj.animated ? "a:" : ""}${emojiObj.name}:${emojiObj?.id}>`, emojiObject: emojiObj }
    //     // message.reply("lmao, commanden '" + command + "' fins ikkje <a:kekw_animated:" + kekw?.id + "> ." + (matched ? " Mente du **" + matched + "**?" : " Prøv !mz help"))

    // }}
}
