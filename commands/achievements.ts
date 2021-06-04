import { Message } from "discord.js";
import { AchievementHelper } from "../helpers/achievementHelper";
import { DatabaseHelper } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { ICommandElement } from "./commands";

export type achievementIDs = "firstSpin" | "100spin" | "1000spin" | "5000spin" | "10000spin";



export interface MZAchievement {
    id: achievementIDs,
    title: string,
    description: string,
    points: number,
}

export const achievements: MZAchievement[] = [
    { id: "firstSpin", title: "Første spin", description: "Spin fidget spinneren 1 gang", points: 5 },
    { id: "100spin", title: "100 spins", description: "Spin fidget spinneren 100 ganger", points: 15 },
    { id: "1000spin", title: "1000 spins", description: "Spin fidget spinneren 1000 ganger", points: 25 },
    { id: "5000spin", title: "5000 spins", description: "Spin fidget spinneren 5000 ganger", points: 35 },
    { id: "10000spin", title: "10000 spins", description: "Spin fidget spinneren 10000 ganger", points: 50 },

];


export class Achievements {

    static awardAchievement(username: string, achievementID: achievementIDs, rawMessage: Message, silent?: boolean) {
        const achiev = achievements.find((el) => el.id == achievementID);
        DatabaseHelper.setAchievementObject("achievement", username, achievementID, achiev?.points)
        if (!silent)
            MessageHelper.sendMessage(rawMessage, "Gratulerer! Du har låst opp et achievement: " + achiev?.title + ". " + achiev?.description + " (" + achiev?.points + " poeng).")
    }

    static findAchievementById(id: string) {
        return achievements.find((el) => el.id == id);
    }

    static listUserAchievements(message: Message) {
        const allAchievs = DatabaseHelper.getValue("achievement", message.author.username);

        let printList = "**Dine achievements**";
        let totalScore = 0;
        if (!!allAchievs) {
            Object.keys(allAchievs).forEach((achievement, index) => {
                const currentAch = Achievements.findAchievementById(achievement);
                printList += `\n${index + 1}: ${currentAch?.title} - ${currentAch?.description} (${currentAch?.points}) `
                totalScore += currentAch?.points ?? 0;
            })
            if (totalScore == 0)
                printList = "Du har ikke opplåst noen achievements enda. Bruk !mz achievements for å se en liste over alle (Ikke implementert)"
            MessageHelper.sendMessage(message, printList)
        }
    }

    static async awardMissing(message: Message) {
        const users = await DatabaseHelper.getAllUsers()
        // console.log(users);

        Object.keys(users).forEach((username) => {
            const currentTotalspin = DatabaseHelper.getValue("counterSpin", username);
            AchievementHelper.awardSpinningAch(username, currentTotalspin, message)

        })
    }

    static readonly listAchievements: ICommandElement = {
        commandName: "achievements",
        description: "Se dine achievements",
        command: (rawMessage: Message, messageContent: string) => {
            Achievements.listUserAchievements(rawMessage);
        }
    }
    static readonly giveMissingAchievements: ICommandElement = {
        commandName: "missingach",
        description: "Se dine achievements",
        isAdmin: true,
        hideFromListing: true,
        command: (rawMessage: Message, messageContent: string) => {
            Achievements.awardMissing(rawMessage);
        }
    }
}