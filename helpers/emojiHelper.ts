import { Emoji, GuildEmoji, Message } from "discord.js";

export type emojiType = "kekw_animated" | "catJAM" | "eyebrows";
export interface emojiReturnType {
    id: string;
    emojiObject?: GuildEmoji;
}
export class EmojiHelper {
    static async getEmoji(
        emojiType: emojiType,
        message: Message
    ): Promise<emojiReturnType> {
        let emojiObj;
        let animated = false;
        if (emojiType === "kekw_animated") {
            emojiObj = await message.client.emojis.cache.find(
                (emoji) => emoji.name == "kekw_animated"
            );
            animated = true;
        } else if (emojiType === "catJAM") {
            emojiObj = await message.client.emojis.cache.find(
                (emoji) => emoji.name == "catJAM"
            );
            animated = true;
        } else if (emojiType === "eyebrows") {
            emojiObj = await message.client.emojis.cache.find(
                (emoji) => emoji.name == "eyebrows"
            );
            animated = true;
        }
        if (!emojiObj) return { id: "<Fant ikke emojien>" };
        return {
            id: `<${animated ? "a:" : ""}${emojiType}:${emojiObj?.id}>`,
            emojiObject: emojiObj,
        };
        // message.reply("lmao, commanden '" + command + "' fins ikkje <a:kekw_animated:" + kekw?.id + "> ." + (matched ? " Mente du **" + matched + "**?" : " Prøv !mz help"))
    }
}
