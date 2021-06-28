import { Message } from "discord.js";
import { imgflip } from "../client-env";
import { MessageHelper } from "../helpers/messageHelper";
import { ICommandElement } from "./commands";
const fetch = require("node-fetch");
export class Meme {

    static readonly baseURL = "https://api.imgflip.com/caption_image";

    static async findMemeIdAndCreate(message: Message, content: string, args: string[]) {
        if (args[0] == "anakin" || args[0] == "322841258")
            return await this.createMeme("322841258", content, message, args)
        if (args[0] == "timmy" || args[0] == "26433458")
            return await this.createMeme("26433458", content, message, args)
        if (args[0] == "sjøsyk" || args[0] == "hallgeir")
            MessageHelper.sendMessage(message, "https://i.imgur.com/ka7SslJ.jpg")
        return;
    }

    static async sendMeme(message: Message, content: string, args: string[]) {
        const meme = await this.findMemeIdAndCreate(message, content, args)
    }
    static async createMeme(templateId: string, messageContent: string, message: Message, args: string[]) {
        const splitContent = messageContent.split(":");
        splitContent[0] = splitContent[0].split(" ").slice(1).join(" ");
        if (splitContent[0] && splitContent[1]) {
            const id = templateId;
            const fetchUrl = Meme.baseURL + ``
            const params = new URLSearchParams({
                "username": imgflip.u,
                "password": imgflip.p,
                "template_id": id,
                "text0": "tomas",
                "text1": "toget",
                "max_font_size": "25"

            });
            const box0Params = Meme.getBoxCoords(templateId).filter(e => e.boxId == "0")[0];
            const box1Params = Meme.getBoxCoords(templateId).filter(e => e.boxId == "1")[0];
            const box2Params = Meme.getBoxCoords(templateId).filter(e => e.boxId == "2")[0];
            params.append("boxes[0][text]", (splitContent[0] ?? "Mangler tekst"))
            params.append("boxes[0][x]", box0Params.x)
            params.append("boxes[0][y]", box0Params.y)
            params.append("boxes[0][width]", box0Params.width)
            params.append("boxes[0][height]", box0Params.height)
            if (splitContent[1] && box1Params) {
                params.append("boxes[1][text]", (splitContent[1] ?? "Mangler tekst"))
                params.append("boxes[1][x]", box1Params.x)
                params.append("boxes[1][y]", box1Params.y)
                params.append("boxes[1][width]", box1Params.width)
                params.append("boxes[1][height]", box1Params.height)
            }

            if (splitContent[2] && box2Params) {
                params.append("boxes[2][text]", (splitContent[2] ?? "Mangler tekst"))
                params.append("boxes[2][x]", box2Params.x)
                params.append("boxes[2][y]", box2Params.y)
                params.append("boxes[2][width]", box2Params.width)
                params.append("boxes[2][height]", box2Params.height)
            }

            fetch(fetchUrl, {
                method: "POST", headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                }, body: params
            }).then((res: any) => {
                res.json().then((el: any) => {
                    if (el.data) MessageHelper.sendMessage(message, el.data.url)
                    else console.log(el);
                })
            }
            );
        } else {
            message.reply("Du mangler noen tekster")
        }
    }

    static getBoxCoords(id: string): { boxId: string, x: string, y: string, width: string, height: string }[] {
        //Specific for Anakin
        if (id === "322841258") {
            const commonWidth = "400";
            const commonHeight = "100";
            return [
                { boxId: "0", x: "10", y: "300", width: commonWidth, height: commonHeight },
                { boxId: "1", x: "375", y: "10", width: commonWidth, height: commonHeight },
                { boxId: "2", x: "375", y: "650", width: commonWidth, height: commonHeight }
            ]
        }
        //Timmys Dad meme
        if (id === "26433458") {
            const commonWidth = "310";
            const commonHeight = "100";
            return [
                { boxId: "0", x: "-10", y: "145", width: commonWidth, height: commonHeight },
                { boxId: "1", x: "-10", y: "325", width: commonWidth, height: commonHeight },
            ]
        }
        return [{ boxId: "0", x: "10", y: "300", width: "300", height: "100" }]
    }

    static readonly makeMemeCommand: ICommandElement = {
        commandName: "meme",
        description: "Lag et meme. '!mz meme <anakin|timmy> text1:text2:text3:text4'",

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            Meme.sendMeme(rawMessage, messageContent, args);
        }
    }
}