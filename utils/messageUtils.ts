import { Message } from "discord.js"
const leetReg = new RegExp(/(1337)/ig);

export namespace MessageUtils {
    export const doesMessageIdHaveCoolNumber = (message: Message) => {
        const msgId = message.id;
        if (leetReg.test(msgId))
            return "1337";
        return "none";
    }

    export const isArgsAtleastThisLong = (args: string[], neededLength: number) => {
        return (args.length - 1) === neededLength;
    }
}