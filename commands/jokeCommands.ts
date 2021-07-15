import { time } from "console";
import { Message, User, TextChannel } from "discord.js";
import { parse } from "dotenv/types";
import { globalArrays } from "../globals";
import { AchievementHelper } from "../helpers/achievementHelper";
import { DatabaseHelper } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { ArrayUtils } from "../utils/arrayUtils";
import { countdownTime, DateUtils } from "../utils/dateUtils";
import { findLetterEmoji } from "../utils/miscUtils";
import { getUsernameInQuotationMarks, msToTime, reverseMessageString } from "../utils/textUtils";
import { ICommandElement } from "./commands";
import { EmojiHelper } from "../helpers/emojiHelper";

export class JokeCommands {
    static async vaskHuset(message: Message) {
        await MessageHelper.sendMessage(
            message,
            Math.random() < 0.75
                ? "Øyvind, vask huset!"
                : "Har ei jækla fine klokka"
        );
    }

    static async kLikka(message: Message) {
        await MessageHelper.sendMessage(
            message,
            Math.random() < 0.5
                ? "Han " +
                (Math.random() < 0.5 ? "skaaahhæææææmmmmm" : "") +
                "trunte på vei te buen "
                : " krækka open a kold one"
        );
    }

    static async thomasTing(message: Message) {
        await MessageHelper.sendMessage(
            message,
            Math.random() < 0.3
                ? "Har fese :)"
                : Math.random() < 0.5
                    ? "Hæ, Erlend Navle?"
                    : "Sovna på golve :)"
        );
    }

    static async mordi(message: Message) {
        const emoji = await EmojiHelper.getEmoji("eyebrows", message);

        await MessageHelper.sendMessage(
            message,
            Math.random() > 0.05
                ? `E nais ${emoji.id}`
                : `E skamnais :eyebrows: ${emoji.id}`
        );
    }

    static async eivind(message: Message) {
        await MessageHelper.sendMessage(
            message,
            Math.random() < 0.7
                ? "Lure på om most important news showe up på vår channel? Kan någen oppdatera han på server-bot-news-channel-fronten, faen ka"
                : "Spsie pistasj :3"
        );
    }

    static async isMaggiPlaying(
        message: Message,
        content: string,
        args: string[]
    ) {
        let name = "maggi";
        if (args[0]) name = args[0];
        const guild = message.channel.client.guilds.cache.get(
            "340626855990132747"
        );
        if (guild) {
            const user = guild.members.cache
                .filter((u) => u.user.username == name)
                .first();
            if (user) {
                if (user.presence.clientStatus) {
                    if (
                        user.presence.activities &&
                        user.presence.activities[0]
                    ) {
                        const game =
                            user.presence.activities[0].name == "Custom Status"
                                ? user.presence.activities[1]
                                : user.presence.activities[0];
                        await MessageHelper.sendMessage(
                            message,
                            `${name} e ${user.presence.clientStatus.desktop
                                ? "på pc-en"
                                : user.presence.clientStatus.mobile
                                    ? "på mobilen"
                                    : "i nettleseren"
                            } ${game
                                ? "med aktiviteten " + game.name + "."
                                : "uten någe aktivitet."
                            }`
                        );
                    } else {
                        await MessageHelper.sendMessage(
                            message,
                            "Ingen aktivitet registrert på Discord. Sover han? Drikker han? Begge deler samtidig? "
                        );
                    }
                } else {
                    await MessageHelper.sendMessage(
                        message,
                        "Magnus er ikke online. Da sover han mest sannsynlig. Kødda, han får ikke sove med alt bråket fra byggeplassen kekw"
                    );
                }
            } else {
                await MessageHelper.sendMessage(
                    message,
                    "Ingen bruker med er registrert med det brukernavnet på serveren. Dårlig koding?"
                );
            }
        }
    }

    static async updateMygleStatus(message: Message, messageContent: string) {
        const regex = new RegExp(/(?<=\<)(.*?)(?=\>)/gi);
        let content = messageContent;
        const matchedUsrname = content.match(regex);
        let url;
        if (message.attachments) {
            url = message.attachments.first()?.url;
        }

        const count = messageContent.split("://")
        const count2 = messageContent.split("www")
        if (count.length > 2 || count2.length > 2) {
            message.reply("Max ein attachment, bro")
            return;
        }

        if (matchedUsrname) {
            const id = matchedUsrname.forEach(
                (el, index) => {
                    const mentionedId = el.replace("@!", "")
                    message.mentions.users.forEach(
                        (el) => {
                            if (mentionedId == el.id) {
                                const replaceThis = "<" + matchedUsrname[index] + ">"
                                content = content.replace(replaceThis, el.username)
                            }
                        })
                });
        };

        if (content.length < 150 && content.trim().length > 0) {
            if (message.content.includes("!zm")) [
                content = reverseMessageString(content)
            ]
            DatabaseHelper.setValue("mygling", message.author.username, content + (url ? " " + url : ""));

            const emoji = ArrayUtils.randomChoiceFromArray(globalArrays.emojiesList)

            message.react(emoji)

        }
        else {
            MessageHelper.sendMessage(message, content.trim().length > 0 ? "Du kan kje mygla så møye. Mindre enn 150 tegn, takk" : "Du må sei koffor du mygle, bro");
        }
    }
    static async getAllMygleStatus(message: Message) {
        const mygling = await DatabaseHelper.getAllValuesFromPrefix("mygling", message)
        let myglinger = "";
        mygling.forEach((status) => myglinger += status.val ? status.key + " " + status.val + "\n" : "")
        myglinger = myglinger.trim() ? myglinger : "Ingen har satt statusen sin i dag";
        MessageHelper.sendMessage(message, myglinger)
        // const vals = await DatabaseHelper.getAllValuesFromPrefix("mygling")
    }



    static async eivindprideItAll(message: Message) {
        try {
            const channel = message.channel as TextChannel;
            const react = message.guild?.emojis.cache.find(emoji => emoji.name == "eivindpride")

            if (message.client) {
                channel.messages.fetch({ limit: 15, }, false, true).then((el) => {
                    el.forEach((message) => {
                        if (react)
                            message.react(react)
                    })
                }).catch((error: any) => {
                    MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error);
                })
            }
        } catch (error) {
            MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error);
        }
        if (message.guild) {
            const react = message.guild.emojis.cache.find(emoji => emoji.name == "eivindpride")
            if (react) {
            }
        }
    }
    /** 
     * String sent must not contain repeat characters 
     */
    static async reactWithLetters(message: Message, msgContent: string, args: string[] | undefined) {
        const splitTab = msgContent.split(" ");
        let msgId = "";
        let letterTab: string[] = []

        for (let i = 0; i < splitTab.length; i++) {
            if (splitTab[i].length > 10 && parseInt(splitTab[i]))
                msgId = splitTab[i];
            else {
                const newWord = ((i == 0 ? "" : " ") + splitTab[i]).trim();
                letterTab = letterTab.concat(newWord.split(""))
            }
        }
        let messageToReactTo = message;
        if (msgId) {
            let searchMessage = await MessageHelper.findMessageById(message, msgId)
            if (searchMessage)
                messageToReactTo = searchMessage;
        }

        let usedLetter = "";
        let spaceCounter = 0;
        letterTab.forEach((letter: string) => {
            if (usedLetter.includes(letter) && letter == " ") {
                spaceCounter++;
            }
            const emoji = usedLetter.includes(letter) ? findLetterEmoji(letter, true, spaceCounter) : findLetterEmoji(letter)
            usedLetter += letter
            messageToReactTo.react(emoji)
        })
    }
    static kanPersonen(message: Message, msgContent: string, args: string[]) {
        MessageHelper.sendMessage(message, `${getUsernameInQuotationMarks(args[0]) ?? args[0]} ` + ArrayUtils.randomChoiceFromArray(globalArrays.kanIkkjeTekster))
    }

    static async uWuIfyer(message: Message, msgContent: string, args: string[]) {
        let fMsg;
        if (args && args[0] && args[0].length > 10 && parseInt(args[0])) {
            fMsg = await MessageHelper.sendMessage(message, "Leter etter meldingen...")
            const msgToUwU = await <Message><unknown>MessageHelper.findMessageById(message, msgContent);
            if (msgToUwU) {
                const uwuIfiedText = JokeCommands.uwuText(msgToUwU.content)
                if (fMsg)
                    fMsg.edit(uwuIfiedText)
                else
                    MessageHelper.sendMessage(message, uwuIfiedText)
            }
            if (!msgToUwU && fMsg)
                fMsg.edit("Fant ikke meldingen \:(")
        } else {
            let textToBeUwued = JokeCommands.uwuText(args.length > 0 ? args.join(" ") : "Please skriv inn ein tekst eller id neste gang");
            MessageHelper.sendMessage(message, textToBeUwued)
        }
    }

    static async sendBonk(message: Message, content: string, args: string[]) {
        const img = ArrayUtils.randomChoiceFromArray(globalArrays.bonkMemeUrls)
        let user;
        let bkCounter;
        if (args.length > 0) {
            user = args[0];
            if (DatabaseHelper.findUserByUsername(user, message)) {
                bkCounter = DatabaseHelper.getValue("bonkCounter", user, message);
                this.incrementBonkCounter(message, user, bkCounter)
                bkCounter = parseInt(bkCounter) + 1;
                MessageHelper.sendMessage(message, (user ? user + ", du har blitt bonket. (" + `${bkCounter} ${bkCounter == 1 ? 'gang' : 'ganger'}) ` : "") + img)
            } else {
                message.reply("du har ikke oppgitt et gyldig brukernavn")
            }


        } else {

            MessageHelper.sendMessage(message, img)
        }
    }

    static incrementBonkCounter(message: Message, user: string, counter: string) {
        // const currentVal = DatabaseHelper.getValue("counterSpin", message.author.username, () => { });
        if (counter) {
            try {
                let cur = parseInt(counter);
                cur = cur += 1;
                AchievementHelper.awardBonkingAch(user, cur.toString(), message)

                DatabaseHelper.setValue("bonkCounter", user, cur.toString())
                return cur;
            } catch (error) {
                MessageHelper.sendMessageToActionLogWithDefaultMessage(message, error)
            }
        }
    }

    private static uwuText(t: string) {
        const firstChoice = ArrayUtils.randomChoiceFromArray(globalArrays.asciiEmojies);
        return firstChoice.concat(" " + t.replace(/r/g, "w").replace(/l/g, "w").concat(" ", ArrayUtils.randomChoiceFromArray(globalArrays.asciiEmojies.filter(e => e !== firstChoice))));
    }

    /*
    COMMAND ELEMENTS START

    */
    static readonly roggaVaskHuset: ICommandElement = {
        commandName: "øyvind",
        description: "Vask huset maen. Og husk å vask den fine klokkå",
        command: (rawMessage: Message, messageContent: string) => {
            JokeCommands.vaskHuset(rawMessage);
        }
    }
    static readonly bonkSender: ICommandElement = {
        commandName: "bonk",
        description: "Send en bonk. Kan brukes mot brukere.",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            JokeCommands.sendBonk(rawMessage, messageContent, args);
        }
    }
    static readonly reactWithWord: ICommandElement = {
        commandName: "spell",
        description: "Stav ut en setning som emojier i reactions. Syntax: <ord/setning> <(optional) message-id>. Ordet bør ikke inneholde repeterte bokstaver; kun ABCIMOPRSTVX har to versjoner og kan repeteres. Hvis ingen message id gis reagerer den på sendt melding. ",
        command: (rawMessage: Message, messageContent: string, args: string[] | undefined) => {
            JokeCommands.reactWithLetters(rawMessage, messageContent, args);
        }
    }

    static readonly mygleStatus: ICommandElement = {
        commandName: "status",
        description: "Sett din status",
        command: (rawMessage: Message, messageContent: string) => {
            JokeCommands.updateMygleStatus(rawMessage, messageContent);
        }
    }
    static readonly getAllMygling: ICommandElement = {
        commandName: "statuser",
        description: "Mygles det?",
        command: (rawMessage: Message, messageContent: string) => {
            JokeCommands.getAllMygleStatus(rawMessage);
        }
    }
    static readonly thomasFese: ICommandElement = {
        commandName: "thomas",
        description: "Thomas svarer alltid ja",
        command: (rawMessage: Message, messageContent: string) => {
            JokeCommands.thomasTing(rawMessage);
        }
    }
    static readonly deadmaggi: ICommandElement = {
        commandName: "maggi",
        description: "Går det egentlig bra med masteren te Magnus?",
        deprecated: "aktivitet",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            JokeCommands.isMaggiPlaying(rawMessage, messageContent, args);
        }
    }
    static readonly kekwCommand: ICommandElement = {
        commandName: "kekw",
        description: "kekw",
        command: async (rawMessage: Message, messageContent: string, args: string[]) => {
            const kekw = await rawMessage.client.emojis.cache.find(emoji => emoji.name == "kekw_animated");
            if (kekw) {
                rawMessage.react(kekw)
                rawMessage.reply("<a: kekw_animated: " + kekw?.id + " > .")
            }
        }
    }
    static readonly activityCommand: ICommandElement = {
        commandName: "aktivitet",
        description: "Går det egentlig bra med masteren te Magnus?",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            JokeCommands.isMaggiPlaying(rawMessage, messageContent, args);
        }
    }
    static readonly eivindSkyld: ICommandElement = {
        commandName: "eivind",
        description: "Eivind sin feil",
        command: (rawMessage: Message, messageContent: string) => {
            JokeCommands.eivind(rawMessage);
        }
    }
    static readonly elDavido: ICommandElement = {
        commandName: "david",
        description: "nå klikke det snart",
        command: (rawMessage: Message, messageContent: string) => {
            JokeCommands.kLikka(rawMessage);
        }
    }
    static readonly eivndPrideCommand: ICommandElement = {
        commandName: "eivindpride",
        description: "Eivindpride it. Eivindpride it ALL.",
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            JokeCommands.eivindprideItAll(rawMessage);
        },
    };
    static readonly kanCommand: ICommandElement = {
        commandName: "kan",
        description: "Kan personen? Sikkert ikkje",
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            JokeCommands.kanPersonen(rawMessage, messageContent, args);
        },
    };
    static readonly uwuMessage: ICommandElement = {
        commandName: "uwu",
        description: "UwU-ify en melding",

        command: (
            rawMessage: Message,
            messageContent: string,
            args: string[]
        ) => {
            JokeCommands.uWuIfyer(rawMessage, messageContent, args);
        },
    };

    static readonly mordiMessage: ICommandElement = {
        commandName: "mordi",
        description: "Mordi e nais",

        command: (
            rawMessage: Message,
            messageContent: string,
            args: string[]
        ) => {
            JokeCommands.mordi(rawMessage);
        },
    };
}
