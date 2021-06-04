import { DatabaseHelper } from "./databaseHelper";
import { Achievements } from "../commands/achievements";
import { Message, TextChannel } from "discord.js";
import { MessageHelper } from "./messageHelper";

export class AchievementHelper {

    static awardSpinningAch(username: string, currentTotalspin: string, message: Message, silent?: boolean) {

        if (currentTotalspin) {
            try {
                let cur = parseInt(currentTotalspin);
                if (cur >= 1)
                    Achievements.awardAchievement(username, "firstSpin", message, silent)
                if (cur >= 100)
                    Achievements.awardAchievement(username, "100spin", message, silent)
                if (cur >= 1000)
                    Achievements.awardAchievement(username, "1000spin", message, silent)
                if (cur >= 5000)
                    Achievements.awardAchievement(username, "5000spin", message, silent)
                if (cur >= 10000)
                    Achievements.awardAchievement(username, "10000spin", message, silent)
                DatabaseHelper.setValue("counterSpin", username, cur.toString())
            } catch (error) {
                message.reply("Noe gikk galt. Stacktrace: " + error)
            }
        }
    }
}