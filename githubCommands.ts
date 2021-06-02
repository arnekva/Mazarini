import { ICommandElement } from "./commands";
import { Message, User } from "discord.js";
import { MessageHelper } from "./messageHelper";
import axios from 'axios';
import { Admin } from "./admin";
const fetch = require("node-fetch");
const base64 = require('base-64');

interface GitHubIssueRequest {
	title: string;
	body: string;
}

export class GitHubCommands {

	static async addIssue(message: Message, messageContent: string) {
			const issue = messageContent.trim()
			const titleAndBody = issue.split("-m")

			console.log(issue)
			const githubToken = process.env.GITHUB_TOKEN
			const url = "https://api.github.com/repos/arnekva/Mazarini-Bot/issues"

			if (titleAndBody[0].length > 0) {
				await fetch(url, {
					method: 'POST',
					headers: {
						"Authorization": 'Bearer ' + githubToken,
						"accept": "application/vnd.github.v3+json"
					},
					body: JSON.stringify({ title: titleAndBody[0].trim(), body: titleAndBody[1] ? titleAndBody[1] : "" })
				}).then((response: any) => {
					MessageHelper.sendMessage(message.channel, "Har laget et GitHub issue med tittel: " + titleAndBody[0].trim());
				})
			} else {
				message.reply("Du har ikke formattert stringen riktig. Eksempel: '!mz issue *title* -m *body*'")
			}

	}

	static readonly issueCommand: ICommandElement = {
		commandName: "issue",
		description: 'For å lage et GitHub issue på Mazarini sin Discord bot. Formatet er "!mz issue liten tittel -m issue body"',
		hideFromListing: true,
		isAdmin: true,
		command: (rawMessage: Message, messageContent: string) => {
			GitHubCommands.addIssue(rawMessage, messageContent);
		}
	}
}

