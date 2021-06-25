import { Message } from "discord.js";
import { imgflip } from "../client-env";
import { MessageHelper } from "../helpers/messageHelper";
import { ICommandElement } from "./commands";
const fetch = require("node-fetch");
export class Meme {

    static readonly baseURL = "https://api.imgflip.com/caption_image";

    static async findMemeIdAndCreate(message: Message, content: string, args: string[]) {

        if (args[0] == "anakin")
            return await this.createMeme("322841258", content, message)
    }

    static async sendMeme(message: Message, content: string, args: string[]) {
        const meme = await this.findMemeIdAndCreate(message, content, args)
        console.log(meme);

    }
    static async createMeme(templateId: string, messageContent: string, message: Message) {
        const splitContent = messageContent.split(":");
        console.log(splitContent);
        splitContent[0] = splitContent[0].split(" ")[1];
        console.log(splitContent[0] + " ; " + splitContent[1]);

        if (splitContent[0] && splitContent[1]) {
            const id = templateId;
            const box1 = splitContent[0];
            const box2 = splitContent[1];
            const box3 = splitContent[2];

            const fetchUrl = Meme.baseURL + ``
            const params = {
                username: imgflip.u,
                password: imgflip.p,
                'template_id': id,
                'boxes': [
                    {
                        "text": "One does not simply",
                        "x": 10,
                        "y": 10,
                        "width": 548,
                        "height": 100,
                        "color": "#ffffff",
                        "outline_color": "#000000"
                    },
                    {
                        "text": "Make custom memes on the web via imgflip API",
                        "x": 10,
                        "y": 225,
                        "width": 548,
                        "height": 100,
                        "color": "#ffffff",
                        "outline_color": "#000000"
                    }
                ]
            };
            fetch(fetchUrl, { method: "POST", body: JSON.stringify(params) }).then((res: any) => {
                res.json().then((el: any) => {
                    if (el.data) MessageHelper.sendMessage(message, el.data.url)
                    else console.log(el);


                }
                )



            }
            );


        } else {
            console.log("missing stuff");

        }

    }

    static readonly makeMemeCommand: ICommandElement = {
        commandName: "meme",
        description: "Lag et meme.",
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            Meme.sendMeme(rawMessage, messageContent, args);
        }
    }
}