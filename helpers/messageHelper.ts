import { Channel, Client, DMChannel, Message, MessageEmbed, NewsChannel, TextChannel } from "discord.js";

//import {client } from "./index"
// import {action_log_channel} from "./index"
// const Discord = require('discord.js');
// const client = new Discord.Client();
export type typeOfError = "unauthorized" | "error" | "warning";

export class MessageHelper {

    /**
     * Send message to the specified channel
     * @param rawMessage - A raw message type
     * @param message - The string to send
     * @param isError - (optional) if this is an error message, set to true
     * @param errorMsg - (optional) This message will be sent to the admin action log channel
     * @param typeOfError - (optional) The error message will depend on this type
     * return message - Returnerer message objectet som kan brukes (.edit(), .react() etc)
     */
    static sendMessage(rawMessage: Message, message: string, isError?: boolean, errorMsg?: string, typeOfError?: typeOfError) {
        const channel = rawMessage.channel as TextChannel;
        // channel = channel as TextChannel;

        if (typeof message == "object") {
            rawMessage.reply("Hmm .. her kom det en tom eller feilformattering melding. Hendelsen blir loggført så en nerd kan ta en skikk på hva som skjedde <" + message + ">");
            MessageHelper.sendMessageToActionLog(channel, "En tom melding ble forsøkt sendt fra channel " + channel.name + ", forårsaket av en melding fra " + rawMessage.author.username + ". Meldingsinnhold: " + rawMessage.content)
            return;
        }

        channel.type === "text"
        if (!isError) {
            try {
                const msg = channel.send(message)
                return msg;
            } catch (error) {
                return undefined
            };
        } else {
            //First send message to channel it originated from
            if (typeOfError == "unauthorized")
                rawMessage.reply("Du er ikke autorisert til å utføre denne handlingen. Denne hendelsen blir loggført.")
            else if (typeOfError == "error")
                rawMessage.reply("Det har oppstått en feil. Feilkode er logget.")

            //Find action_log
            const errorChannel = channel.client.channels.cache.get("810832760364859432") as TextChannel
            //Send message to action_log
            if (errorChannel) {
                if (channel.type === "text") {
                    if (typeOfError == "warning")
                        errorChannel.send(channel.name + ": " + errorMsg)
                    else
                        errorChannel.send("En feil har oppstått i channelen " + channel.name + ". " + errorMsg)
                }
            }
            return undefined
        }

    }
    /** Reply til en gitt melding med gitt string. */
    static replyToMessage(message: Message, errormessage: string) {
        message.reply(errormessage)
    }
    /** Reply når feil formattering er brukt. Send inn hvilken formattering som skal brukes */
    static replyFormattingError(message: Message, errormessage: string) {
        message.reply("du har brukt feil formattering. Bruk: " + errormessage)
    }
    static async findMessageById(rawMessage: Message, id: string) {
        const allChannels = rawMessage.client.channels.cache.array().filter(channel => channel instanceof TextChannel) as TextChannel[];
        let messageToReturn;

        for (const channel of allChannels) {
            if (channel) {
                await channel.messages.fetch(id).then(message => {
                    if (message.guild) {
                        messageToReturn = message;
                    }
                }).catch((error: any) => {
                    //ikke catch noe, den thrower exception hvis meldingen ikke finnes (noe den ikke skal gjøre i 9/10 channels)
                    // MessageHelper.sendMessageToActionLogWithDefaultMessage(rawMessage, error);
                })
            }
        }
        return messageToReturn
    }
    /** Send en embedded message (se gambling for eksempel) */
    static async sendFormattedMessage(message: Message, newMessage: MessageEmbed) {
        message.channel.send(newMessage)
    }

    static sendMessageToActionLog(channel: TextChannel, msg: string) {
        const errorChannel = channel.client.channels.cache.get("810832760364859432") as TextChannel
        errorChannel.send(msg);
    }
    static sendMessageToActionLogWithDefaultMessage(message: Message, error: any, ignoreReply?: boolean) {
        const roleId = "863038817794392106"; //Bot-support
        message.reply(`En feil har oppstått. Feilkoden og meldingen din blir logget. <@&${roleId}>`)
        const errorChannel = message.channel.client.channels.cache.get("810832760364859432") as TextChannel
        errorChannel.send(`En feil har oppstått i en melding fra ${message.author.username}. Meldingsinnhold: <${message.content}>. Channel: ${message.channel}. Feilmelding: <${error}>`);
    }
    static sendMessageToBotUtvikling(channel: TextChannel) {
        const errorChannel = channel.client.channels.cache.get("802716150484041751") as TextChannel
        errorChannel.send("Logget på");
    }
    static sendErrorMessage(text: string, channel?: TextChannel) {
        if (channel) {
            channel.send(text)
        }
        // const errorChannel = mazariniClient.channels.cache.get("810832760364859432");
    }

    //Oldchannel er brukt for å ha en referanse til client
    static sendMessageToSpecificChannel(channelId: string, text: string, oldChannel: TextChannel) {

        const msgChannel = oldChannel.client.channels.cache.get(channelId.trim()) as TextChannel
        if (msgChannel) {
            msgChannel.send(text.trim())
        }
        else {
            oldChannel.send("Ingen text channel ble funnet på oppgitt id <" + channelId + ">.")
        }
    }

}
