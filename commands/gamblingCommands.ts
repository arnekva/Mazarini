
import { Message, MessageEmbed } from "discord.js";
import { Channel, Client, DMChannel, NewsChannel, TextChannel } from "discord.js";
import { betObject, betObjectReturned, DatabaseHelper, dbPrefix } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { ArrayUtils } from "../utils/arrayUtils";
import { ObjectUtils } from "../utils/objectUtils";
import { ICommandElement } from "./commands";



export class GamblingCommands {

    //Todo: Add mz startPoll
    //Todo: Add mz endPoll
    //TOdo: Fikse coins converter
    //Todo: Add Butikk

    static async manageCoins(message: Message, messageContent: string, args: string[]) {
        if (!args[0] && !args[1]) {
            MessageHelper.sendMessage(message, `Feil formattering. <brukernavn> <coins>`)
            return;
        }
        const user = args[0];
        const prefix = "dogeCoin";
        let val: string | number = args[1];
        if (Number(val)) {
            const currentVal = DatabaseHelper.getValue(prefix, user, message);
            if (Number(currentVal))
                val = Number(val) + Number(currentVal);
            DatabaseHelper.setValue(prefix, user, val.toString());
            MessageHelper.sendMessage(message, `${user} har nå ${val} dogecoins.`)
        } else
            MessageHelper.sendMessage(message, `Du må bruke et tall som verdi`)
    }


    static async createBet(message: Message, messageContent: string, args: string[]) {
        const hasActiveBet = DatabaseHelper.getActiveBetObject(message.author.username);
        let desc = messageContent;
        if (hasActiveBet) {
            message.reply("Du kan bare ha ett aktivt veddemål om gangen. Gjør ferdig ditt gamle, og prøv på nytt");
            return;
        }
        let value = 100;
        if (!isNaN(Number(args[0]))) {
            value = Number(args[0]);
            desc = desc.slice(args[0].length)
        }
        const betString = `${message.author.username} har startet et veddemål: ${desc} (${value} coins). Reager med 👍 for JA, 👎 for NEI. Resultat vises om 20 sek`
        const startMessage = await MessageHelper.sendMessage(message, betString)
        if (startMessage) {
            startMessage.react("👍")
            startMessage.react("👎")

            setTimeout(function () {
                let fullString = "";
                const positive: string[] = [];
                const negative: string[] = [];
                const allReactions = startMessage.reactions.cache.forEach((reaction) => {
                    fullString += "Folk som reagerte med " + reaction.emoji.name + ":"
                    const users = reaction.users;
                    users.cache.forEach((us, ind) => {
                        if (reaction.emoji.name == "👍")
                            positive.push(us.username)
                        else
                            negative.push(us.username)
                        fullString += (us.username == "Mazarini Bot" ? "" : " " + us.username + ",");
                    })
                    fullString += "\n";
                })
                MessageHelper.sendMessage(message, fullString)

                const obj: betObject = {
                    discriminator: "BETOBJECT",
                    description: desc,
                    messageId: startMessage.id,
                    positivePeople: positive,
                    negativePeople: negative,
                    value: "100",
                }
                DatabaseHelper.setActiveBetObject(message.author.username, obj)
            }, 60000) //Sett til 60000
        }
    }

    static async resolveBet(message: Message, messageContent: string, args: string[]) {
        const username = message.author.username;
        const activeBet = DatabaseHelper.getActiveBetObject(message.author.username) as betObjectReturned;
        if (!activeBet) {
            message.reply("Du kan kun lukke veddemål du har startet selv, og du har ingen aktive.");
            return;
        }
        if (ObjectUtils.instanceOfBetObject(activeBet)) {
            const resolveMessage = await MessageHelper.sendMessage(message, `${username} vil gjøre opp ett veddemål: ${activeBet.description}. Reager med 👍 for å godkjenne (Trenger 3). Venter 60 sekunder. `)
            if (resolveMessage) {
                resolveMessage.react("👍")
                let positiveCounter = 0;

                setTimeout(function () {
                    const allReactions = resolveMessage.reactions.cache.forEach((reaction) => {
                        const users = reaction.users;
                        users.cache.forEach((us, ind) => {
                            if (reaction.emoji.name == "👍")
                                positiveCounter++;
                        })
                    })
                    if (positiveCounter > 2) {
                        const isPositive = args[0].toLocaleLowerCase() === "ja";
                        MessageHelper.sendMessage(message, `Veddemålsresultatet er godkjent. Beløpene blir nå lagt til på kontoene. `)
                        const value = activeBet.value;
                        GamblingCommands.dealCoins(message, activeBet.value, isPositive ? activeBet.positivePeople : activeBet.negativePeople)
                        DatabaseHelper.deleteActiveBet(username);

                    } else {
                        MessageHelper.sendMessage(message, `Veddemålsresultatet ble ikke godkjent. Diskuter og prøv igjen.`)
                    }

                }, 60000) //Sett til 60000
            }

        } else {
            message.reply("object is not instance of betObject. why tho")
        }
    }

    static async krig(message: Message, content: string, args: string[]){
        if(!ArrayUtils.checkArgsLength(args, 2)){
            message.reply("du må oppgi mengde og person. <nummer> <username>")
            return;
        }
        const username = args[1];
        const amount = args[0];
        
        if(isNaN(Number(amount)) || Number(amount) <1){
            message.reply("du må oppgi et gyldig tall")
            return;
        }
          let engagerValue = Number(DatabaseHelper.getValue("dogeCoin", message.author.username, message));
          let victimValue = Number(DatabaseHelper.getValue("dogeCoin", username, message));
          const amountAsNum = Number(amount);
        if(Number(engagerValue) < amountAsNum || Number(victimValue) < amountAsNum){
            message.reply("en av dere har ikke råd til å utføre denne krigen her.")
            return;
        }    
        const resolveMessage = await MessageHelper.sendMessage(message, `${message.author.username} vil gå til krig med deg, ${username}. Reager med 👍 for å godkjenne. Venter 10 sekunder. Den som starter krigen ruller for 0-49.`)
            if (resolveMessage) {
                resolveMessage.react("👍")
                let positiveCounter = 0;

                setTimeout(function () {
                    const allReactions = resolveMessage.reactions.cache.forEach((reaction) => {
                        const users = reaction.users;
                        users.cache.forEach((us, ind) => {
                            if (reaction.emoji.name == "👍" && us.username == username)
                                positiveCounter++;
                        })
                    })
                    if (positiveCounter > 0) {
                        const roll = Math.floor(Math.random() * 101);

                        const gambling = new MessageEmbed()
                            .setTitle("⚔️ Krig ⚔️")
                            .setDescription(`Terningen trillet: ${roll}/100. ${roll < 51 ? (roll == 50 ? "Bot Høie" : message.author.username) : username} vant! 💰💰`)

                    if(roll < 50){
                         engagerValue += amountAsNum;
                        victimValue -= amountAsNum;
                       
                    } else if(roll > 50) {
                         engagerValue -= amountAsNum;
                        victimValue += amountAsNum;
                    } else if(roll == 50){
                         engagerValue -= amountAsNum;
                        victimValue -= amountAsNum;
                    }


                gambling.addField(`${message.author.username}`, `Du har nå ${engagerValue.toLocaleString(undefined, {maximumFractionDigits: 2, minimumFractionDigits: 2})} coins`)
                gambling.addField(`${username}`, `Du har nå ${victimValue.toLocaleString(undefined, {maximumFractionDigits: 2, minimumFractionDigits: 2})} coins`)
                MessageHelper.sendFormattedMessage(message, gambling);
                 DatabaseHelper.setValue("dogeCoin", message.author.username, (engagerValue).toFixed(2))
                 DatabaseHelper.setValue("dogeCoin", username, (victimValue).toFixed(2))       

                    } else {
                        MessageHelper.sendMessage(message, `${username} godkjente ikke krigen.`)
                        // DatabaseHelper.setValue("dogeCoin", message.author.username, (engagerValue-100).toFixed(2))
                    }

                }, 10000) //Sett til 60000
            }
    }

    static diceGamble(message: Message, content: string, args: string[]) {
        const userMoney = DatabaseHelper.getValue("dogeCoin", message.author.username, message);
        const argumentVal = args[0];
        if (!argumentVal || isNaN(Number(argumentVal))) {
            message.reply("Du må si hvor mye du vil gamble")
            return;
        }
        if (userMoney) {
          
            if (Number(argumentVal) > Number(userMoney)) {
                message.reply("Du har ikke nok penger til å gamble så mye. Bruk <!mz lån 1000> for å låne coins fra MazariniBank")
                return;
            } else if (Number(argumentVal) < 1) {
                message.reply("Du må gamble med et positivt tall, bro")
                return;
            }
        }
        if (argumentVal && Number(argumentVal)) {
            const valAsNum = Number(Number(argumentVal).toFixed(2));
            const roll = Math.floor(Math.random() * 100) +1;
            let newMoneyValue = 0;
            let multiplier = GamblingCommands.getMultiplier(roll, valAsNum);
            if (roll >= 50) {

                newMoneyValue = Number(userMoney) + (multiplier * valAsNum);
            }
            else
                newMoneyValue = Number(userMoney) - valAsNum;

                if(newMoneyValue > 1000000000) {
                    DatabaseHelper.setValue("bailout", message.author.username, "true")
                }
                if(newMoneyValue > Number.MAX_SAFE_INTEGER){
                    message.reply("Du har nådd et så høyt tall at programmeringsspråket ikke lenger kan gjøre trygge operasjoner på det. Du kan fortsette å gamble, men noen funksjoner kan virke ustabile")
                }
            DatabaseHelper.setValue("dogeCoin", message.author.username, newMoneyValue.toFixed(2))

            const gambling = new MessageEmbed()
                .setTitle("Gambling 🎲")
                .setDescription(`${message.author.username} gamblet ${valAsNum} av ${userMoney} coins.\nTerningen trillet: ${roll}/100. Du ${roll >= 50 ? "vant! 💰💰" : "tapte 💸"}\nDu har nå ${newMoneyValue.toLocaleString(undefined, {maximumFractionDigits: 2, minimumFractionDigits: 2})} coins.`)
            if (roll >= 100)
                gambling.addField(`Trillet 100!`, `Du trillet 100 og vant ${multiplier} ganger så mye som du satset!`)
            MessageHelper.sendFormattedMessage(message, gambling);
        }
    }
    static getMultiplier(roll: number, amountBet: number) {
        if (roll >= 100)
            return 10;
        return 1;
    }

    static bailout(message: Message){
        const canBailout = DatabaseHelper.getValue("bailout", message.author.username, message)
        const userCoins = DatabaseHelper.getValue("dogeCoin", message.author.username, message)
        if(canBailout === "true" && Number(userCoins) < 100000){
            message.reply(`${message.author.username} har mottatt en redningspakke fra MazariniBank på 500,000,000.`)
            DatabaseHelper.setValue("dogeCoin", message.author.username, "500000000");
        } else {
            message.reply("Beklager, MazariniBank kan ikke gi deg en redningspakke.")
        }
    }

    static takeUpLoan(message: Message, content: string, args: string[]) {
        let amountToLoan = 500;
        if (args[0]) {
            const argAsNum = Number(args[0])

            if (isNaN(argAsNum)) {
                message.reply("du har oppgitt et ugyldig tall")
                return;
            } else if (argAsNum > 5000) {
                message.reply("du kan låne maks 5000 coins")
                return;
            } else if (argAsNum < 1) {
                message.reply("Kan kje låna mindre enn 1 coin")
                return;
            }
            amountToLoan = argAsNum;
        }
        const username = message.author.username;
        const totalLoans = DatabaseHelper.getValue("loanCounter", username, message)
        const totalDebt = DatabaseHelper.getValue("debt", username, message)
        const userMoney = DatabaseHelper.getValue("dogeCoin", message.author.username, message);

        const newTotalLoans = Number(totalLoans) + 1;
        const newDebt = (Number(totalDebt) + amountToLoan) * 1.1;

        DatabaseHelper.setValue("loanCounter", username, newTotalLoans.toString())
        DatabaseHelper.setValue("debt", username, newDebt.toFixed(2))
        const newCoinsVal = Number(userMoney) + amountToLoan;
        DatabaseHelper.setValue("dogeCoin", username, newCoinsVal.toFixed(2))

        MessageHelper.sendMessage(message, `${username}, du har nå lånt ${amountToLoan.toFixed(2)} coins med 10% rente. Spend them well. Din totale gjeld er nå: ${newDebt.toFixed(2)} (${newTotalLoans} lån gjort)`)
    }

    static payDownDebt(message: Message, content: string, args: string[]) {
        const username = message.author.username;
        const totalDebt = DatabaseHelper.getValue("debt", username, message)
        if (Number(totalDebt) <= 0) {
            message.reply("Du har ingen lån")
            return;
        }
        const userMoney = DatabaseHelper.getValue("dogeCoin", message.author.username, message);
        const wantsToPayDownThisAmount = Number(args[0]);
        if (wantsToPayDownThisAmount < 1) {
            message.reply("skriv inn et positivt tall, bro")
            return;
        }
        if (!isNaN(wantsToPayDownThisAmount)) {
            let newTotal = Number(totalDebt) - Number(args[0])

            const userMasNumber = Number(userMoney);
            if (userMasNumber < wantsToPayDownThisAmount) {
                message.reply("du har ikke råd til dette.")
                return;
            } else {
                let backToPayer = 0;
                if (newTotal < 0) {
                    message.reply("du har betalt " + Math.abs(newTotal) + " for mye på lånet ditt. Dette blir tilbakebetalt. ")
                    backToPayer = Math.abs(newTotal);
                }
                newTotal += backToPayer;
                DatabaseHelper.setValue("debt", username, newTotal.toFixed(2))
                const newDogeCoinsCOunter = Number(userMoney) - wantsToPayDownThisAmount + backToPayer;
                DatabaseHelper.setValue("dogeCoin", username, newDogeCoinsCOunter.toFixed(2))
                MessageHelper.sendMessage(message, `Du har nå betalt ned ${wantsToPayDownThisAmount.toFixed(2)} av lånet ditt på ${totalDebt}. Lånet er nå på ${newTotal.toFixed(2)} og du har ${newDogeCoinsCOunter.toFixed(2)} coins igjen.`)
            }
        }
        else {
            message.reply("Du har ikke skrevet inn et tall");
        }
    }
    static vippsCoins(message: Message, content: string, args: string[]) {
        if (!args[0]) {
            message.reply("du må sei kem du ska vippsa, bro")
            return;
        }
        if (!args[1]) {
            message.reply("du må sei kor møye du ska vippsa, bro")
            return;
        }

        let userWhoGetsCoins = args[0];
        let coinsToVipps = args[1];
        if(isNaN(Number(args[1]))){
            userWhoGetsCoins = args[0] + " " + args[1];
            coinsToVipps = args[2];
        }
        if(Number(coinsToVipps) < 1){
            message.reply("Må vippse minst 1 coin, bro")
            return;
        }
        
        const authorBalance = Number(DatabaseHelper.getValue("dogeCoin", message.author.username, message));
        if (authorBalance >= Number(coinsToVipps)) {
            //go ahead
            if (DatabaseHelper.findUserByUsername(userWhoGetsCoins, message)) {
                const newBalance = authorBalance - Number(coinsToVipps);
                DatabaseHelper.setValue("dogeCoin", message.author.username, newBalance.toFixed(2))
                DatabaseHelper.incrementValue("dogeCoin", userWhoGetsCoins, coinsToVipps, message);
                MessageHelper.sendMessage(message, `${message.author.username} vippset ${userWhoGetsCoins} ${coinsToVipps}.`)

            } else {
                message.reply("finner ingen bruker med det navnet")
            }
        } else {
            message.reply("du har ikkje råd te å vippsa så møye, bro")
        }

    }
    static dealCoins(message: Message, value: string, peopleGettingCoins: string) {
        const peopleCoins = peopleGettingCoins.split(",").filter(u => u !== "Mazarini Bot")
        const basePot = 50;
        let pot = basePot;
        const val = Number(value);
        pot += val * peopleCoins.length;
        const shareOfCoins = pot / peopleCoins.length;
        let moneyString = "";
        peopleCoins.forEach((username) => {
            const currentUser = DatabaseHelper.findUserByUsername(username, message)
            const userCoins = DatabaseHelper.getValue("dogeCoin", username, message) as number;
            const newValue = Number(userCoins) + Number(shareOfCoins.toFixed(0));
            DatabaseHelper.setValue("dogeCoin", username, newValue.toString());
            moneyString += `${username}: ${userCoins} -> ${newValue}`
        });
        MessageHelper.sendMessage(message, moneyString)
    }


    static async checkCoins(message: Message, messageContent: string, args: string[]) {
        let username;
        if (!args[0]) {
            username = message.author.username;
        } else
            username = args[0];

        const val = DatabaseHelper.getValue("dogeCoin", username, message)
        MessageHelper.sendMessage(message, `${username} har ${Number(val).toLocaleString(undefined, {maximumFractionDigits: 2, minimumFractionDigits: 2})} dogecoins`)
    }

    static readonly addCoinsCommand: ICommandElement = {
        commandName: "coins",
        description: "Legg til eller fjern coins fra en person. <Brukernavn> <verdi> (pluss/minus)",
        hideFromListing: true,
        isAdmin: true,
        isSuperAdmin: true,
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.manageCoins(rawMessage, messageContent, args);
        }
    }
    static readonly takeLoanCommand: ICommandElement = {
        commandName: "lån",
        description: "Lån 500 coins",

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.takeUpLoan(rawMessage, messageContent, args);
        }
    }
    static readonly payDebtCommand: ICommandElement = {
        commandName: "betal",
        description: "Betal på lånet ditt. <number>",

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.payDownDebt(rawMessage, messageContent, args);
        }
    }
    static readonly bailoutCommand: ICommandElement = {
        commandName: "bailout",
        description: "Motta en bailout fra MazariniBank",

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.bailout(rawMessage);
        }
    }
    static readonly krigCommand: ICommandElement = {
        commandName: "krig",
        description: "Gå til krig. <nummer> <username>",

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.krig(rawMessage, messageContent, args);
        }
    }
    static readonly vippsCommand: ICommandElement = {
        commandName: "vipps",
        description: "Vipps til en annen bruker. <number>",

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.vippsCoins(rawMessage, messageContent, args);
        }
    }
    static readonly gambleCoins: ICommandElement = {
        commandName: "gamble",
        description: "Gambla coinså dine! Skriv inn mengde coins du vil gambla, så kan du vinna dobbelt hvis terningen trille 50 eller mer",

        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.diceGamble(rawMessage, messageContent, args);
        }
    }

    static readonly checkCoinsCommand: ICommandElement = {
        commandName: "checkcoins",
        description: "Check coins on a person",
        deprecated: "wallet",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.checkCoins(rawMessage, messageContent, args);
        }
    }
    static readonly walletCommand: ICommandElement = {
        commandName: "wallet",
        description: "Check coins on a person",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.checkCoins(rawMessage, messageContent, args);
        }
    }
    static readonly createBetCommand: ICommandElement = {
        commandName: "bet",
        description: "Start et ja/nei veddemål",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.createBet(rawMessage, messageContent, args);
        }
    }
    static readonly resolveBetCommand: ICommandElement = {
        commandName: "resolve",
        description: "Resolve veddemålet",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.resolveBet(rawMessage, messageContent, args);
        }
    }

}