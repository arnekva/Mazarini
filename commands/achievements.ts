import { Message } from "discord.js";
import { AchievementHelper } from "../helpers/achievementHelper";
import { DatabaseHelper } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { ICommandElement } from "./commands";

export type achievementIDs = "firstSpin" | "100spin" | "1000spin" | "5000spin" | "10000spin" | "bonkOnce" | "bonk50" | "bonk100";



export interface MZAchievement {
    id: achievementIDs,
    title: string,
    description: string,
    points: number,
}
//Move to file?
export const achievements: MZAchievement[] = [
    { id: "firstSpin", title: "Første spin", description: "Spin fidget spinneren 1 gang", points: 5 },
    { id: "100spin", title: "100 spins", description: "Spin fidget spinneren 100 ganger", points: 15 },
    { id: "1000spin", title: "1000 spins", description: "Spin fidget spinneren 1000 ganger", points: 25 },
    { id: "5000spin", title: "5000 spins", description: "Spin fidget spinneren 5000 ganger", points: 35 },
    { id: "10000spin", title: "10000 spins", description: "Spin fidget spinneren 10000 ganger", points: 50 },
    { id: "bonkOnce", title: "Første bonk", description: "Bli bonket én gang", points: 5 },
    { id: "bonk50", title: "50 bonks", description: "Bli bonket 50 ganger", points: 10 },
    { id: "bonk100", title: "100 bonks", description: "Bli bonket 100 ganger", points: 15 },


];


export class Achievements {

    static awardAchievement(username: string, achievementID: achievementIDs, rawMessage: Message, silent?: boolean) {
        const achiev = achievements.find((el) => el.id == achievementID);
        const hasAchievementsObj = DatabaseHelper.getValue("achievement", username, rawMessage); //FIXME: This line needs to be there to check if Achievements exist, as getValue creates Achievements if not present
        let hasThisAch = DatabaseHelper.getAchievement("achievement", username, achievementID);

        if (!hasThisAch) {
            DatabaseHelper.setAchievementObject("achievement", username, achievementID, achiev?.points)
            if (!silent)
                MessageHelper.sendMessage(rawMessage, "Gratulerer, " + username + "! Du har låst opp et achievement: " + achiev?.title + "! " + achiev?.description + " (" + achiev?.points + " poeng).")
        }

    }

    static findAchievementById(id: string) {
        return achievements.find((el) => el.id == id);
    }

    static listUserAchievements(message: Message) {
        const allAchievs = DatabaseHelper.getValue("achievement", message.author.username, message);

        let printList = "**Dine achievements**";
        let totalScore = 0;
        if (!!allAchievs) {
            Object.keys(allAchievs).forEach((achievement, index) => {
                const currentAch = Achievements.findAchievementById(achievement);
                printList += `\n${index + 1}: ${currentAch?.title} - ${currentAch?.description} (${currentAch?.points}) `
                totalScore += currentAch?.points ?? 0;
            })
            printList += "\n*Achievement Score: " + totalScore + "*";
            if (totalScore == 0)
                printList = "Du har ikke opplåst noen achievements enda. Bruk !mz listachievements for å se en liste over alle (Ikke implementert)"
            MessageHelper.sendMessage(message, printList)
        }
    }

    static async awardMissing(message: Message) {
        const users = await DatabaseHelper.getAllUsers()
        // console.log(users);

        Object.keys(users).forEach((username) => {
            const currentTotalspin = DatabaseHelper.getValue("counterSpin", username, message);
            AchievementHelper.awardSpinningAch(username, currentTotalspin, message, true)

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
        description: "Tildel manglende achievements til brukere. (Brukes når achievement legges til i etterkant)",
        isAdmin: true,
        hideFromListing: true,
        command: (rawMessage: Message, messageContent: string) => {
            Achievements.awardMissing(rawMessage);
        }
    }
}