
import { Message, MessageEmbed } from "discord.js";
import { Channel, Client, DMChannel, NewsChannel, TextChannel } from "discord.js";
import { betObject, betObjectReturned, DatabaseHelper, dbPrefix } from "../helpers/databaseHelper";
import { MessageHelper } from "../helpers/messageHelper";
import { ArrayUtils } from "../utils/arrayUtils";
import { ObjectUtils } from "../utils/objectUtils";
import { getUsernameInQuotationMarks } from "../utils/textUtils";
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
        const hasActiveBet = DatabaseHelper.getActiveBetObject(message.author.id);
        const userBalance = DatabaseHelper.getValue("chips", message.author.id, message);
        let desc = messageContent;
        if (hasActiveBet) {
            message.reply("Du kan bare ha ett aktivt veddemål om gangen. Gjør ferdig ditt gamle, og prøv på nytt");
            return;
        }
        let betVal = 100;
        if (!isNaN(Number(args[0]))) {
            betVal = Number(args[0]);
            desc = desc.slice(args[0].length)
        }
        if (betVal > Number(userBalance)) {
            message.reply("Du har kje råd te dette bro")
            return;
        }
        const betString = `${message.author.username} har startet et veddemål: ${desc} (${betVal} chips). Reager med 👍 for JA, 👎 for NEI. Resultat vises om 60 sek`
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
                        const userBal = DatabaseHelper.getValue("chips", us.id, message);
                        if (Number(userBal) < betVal && (us.username !== "Mazarini Bot")) {
                            fullString += us.username + "(har ikke råd og blir ikke telt med),"
                        } else {
                            if (us.username !== "Mazarini Bot") {
                                DatabaseHelper.setValue("chips", us.id, (Number(userBal) - betVal).toFixed(2));
                                if (reaction.emoji.name == "👍")
                                    positive.push(us.username)
                                else if (reaction.emoji.name == "👎")
                                    negative.push(us.username)
                                fullString += (us.username == "Mazarini Bot" ? "" : " " + us.username + ",");
                            }
                        }

                    })
                    fullString += "\n";
                })
                if (positive.length == 0 && negative.length == 0) {
                    message.reply("Ingen svarte på veddemålet. ")
                    return;
                }
                MessageHelper.sendMessage(message, fullString)

                const obj: betObject = {
                    description: desc,
                    messageId: startMessage.id,
                    positivePeople: positive,
                    negativePeople: negative,
                    value: betVal.toFixed(2),

                }
                DatabaseHelper.setActiveBetObject(message.author.id, obj)
            }, 60000) //Sett til 60000
        }
    }

    static async resolveBet(message: Message, messageContent: string, args: string[],) {
        const username = message.author.username;
        const activeBet = DatabaseHelper.getActiveBetObject(message.author.id) as betObjectReturned;
        if (!activeBet) {
            message.reply("Du kan kun lukke veddemål du har startet selv, og du har ingen aktive.");
            return;
        }
        if (args[0] === "slett") {
            let numP = 0;
            const negSplit = activeBet.negativePeople.split(",");
            const posSplit = activeBet.positivePeople.split(",");
            if (negSplit[0] !== "")
                numP += negSplit.length;
            if (posSplit[0] !== "")
                numP += posSplit.length;
            // GamblingCommands.dealCoins(message, activeBet.value, activeBet.positivePeople.concat(activeBet.negativePeople), numP, true)
            DatabaseHelper.deleteActiveBet(username);
            message.reply("Veddemålet er slettet, og beløp er tilbakebetalt.")
            return;
        }
        if (args[0].toLocaleLowerCase() !== "nei" && args[0].toLocaleLowerCase() !== "ja") {
            message.reply("Du må legge til om det var 'ja' eller 'nei' som var utfallet av veddemålet")
            return;
        }
        DatabaseHelper.deleteActiveBet(username);
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

                        GamblingCommands.dealCoins(message, activeBet.value, isPositive ? activeBet.positivePeople : activeBet.negativePeople, (activeBet.negativePeople.split(",").length + activeBet.positivePeople.split(",").length))
                        DatabaseHelper.deleteActiveBet(username);

                    } else {
                        MessageHelper.sendMessage(message, `Veddemålsresultatet ble ikke godkjent. Diskuter og prøv igjen.`)
                        DatabaseHelper.setActiveBetObject(message.author.id, activeBet)
                    }

                }, 60000) //Sett til 60000
            }

        } else {
            message.reply("object is not instance of betObject. why tho")
        }
    }

    static async krig(message: Message, content: string, args: string[]) {
        if (!ArrayUtils.checkArgsLength(args, 2)) {
            message.reply("du må oppgi mengde og person. <nummer> <username>")
            return;
        }

        let username = getUsernameInQuotationMarks(content) ?? args[1];
        const amount = args[0];
        const victimUser = DatabaseHelper.findUserByUsername(username, message);
        if (!victimUser) {
            message.reply("fant ikke bruker")
            return;
        }
        if (isNaN(Number(amount)) || Number(amount) < 1) {
            message.reply("du må oppgi et gyldig tall")
            return;
        }
        let engagerValue = Number(DatabaseHelper.getValue("chips", message.author.username, message));
        let victimValue = Number(DatabaseHelper.getValue("chips", victimUser?.id, message));
        const amountAsNum = Number(amount);
        if (Number(engagerValue) < amountAsNum || Number(victimValue) < amountAsNum) {
            message.reply("en av dere har ikke råd til å utføre denne krigen her.")
            return;
        }
        const resolveMessage = await MessageHelper.sendMessage(message, `${message.author.username} vil gå til krig med deg, ${victimUser.username}. Reager med 👍 for å godkjenne. Venter 10 sekunder. Den som starter krigen ruller for 0-49.`)
        if (resolveMessage) {
            resolveMessage.react("👍")
            let positiveCounter = 0;

            setTimeout(function () {
                const allReactions = resolveMessage.reactions.cache.forEach((reaction) => {
                    const users = reaction.users;
                    users.cache.forEach((us, ind) => {
                        if (reaction.emoji.name == "👍" && us.username == victimUser.username)
                            positiveCounter++;
                    })
                })
                if (positiveCounter > 0) {
                    const roll = Math.floor(Math.random() * 101);

                    const gambling = new MessageEmbed()
                        .setTitle("⚔️ Krig ⚔️")
                        .setDescription(`Terningen trillet: ${roll}/100. ${roll < 51 ? (roll == 50 ? "Bot Høie" : message.author.username) : victimUser.username} vant! 💰💰`)

                    if (roll < 50) {
                        engagerValue += amountAsNum;
                        victimValue -= amountAsNum;

                    } else if (roll > 50) {
                        engagerValue -= amountAsNum;
                        victimValue += amountAsNum;
                    } else if (roll == 50) {
                        engagerValue -= amountAsNum;
                        victimValue -= amountAsNum;
                    }


                    gambling.addField(`${message.author.username}`, `Du har nå ${engagerValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} chips`)
                    gambling.addField(`${username}`, `Du har nå ${victimValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} chips`)
                    MessageHelper.sendFormattedMessage(message, gambling);
                    DatabaseHelper.setValue("chips", message.author.id, (engagerValue).toFixed(2))
                    DatabaseHelper.setValue("chips", victimUser.id, (victimValue).toFixed(2))

                } else {
                    MessageHelper.sendMessage(message, `${username} godkjente ikke krigen.`)
                    // DatabaseHelper.setValue("dogeCoin", message.author.username, (engagerValue-100).toFixed(2))
                }

            }, 10000) //Sett til 60000
        }
    }

    static diceGamble(message: Message, content: string, args: string[]) {
        const userMoney = DatabaseHelper.getValue("chips", message.author.id, message);
        const argumentVal = args[0];
        if (!argumentVal || isNaN(Number(argumentVal))) {
            message.reply("Du må si hvor mye du vil gamble")
            return;
        }
        if (userMoney) {

            if (Number(argumentVal) > Number(userMoney)) {
                message.reply("Du har ikke nok penger til å gamble så mye. Bruk <!mz lån 100> for å låne chips fra MazariniBank")
                return;
            } else if (Number(argumentVal) < 1) {
                message.reply("Du må gamble med et positivt tall, bro")
                return;
            }
        }
        if (argumentVal && Number(argumentVal)) {
            const valAsNum = Number(Number(argumentVal).toFixed(2));
            const roll = Math.floor(Math.random() * 100) + 1;
            let newMoneyValue = 0;
            let multiplier = GamblingCommands.getMultiplier(roll, valAsNum);
            if (roll >= 50) {

                newMoneyValue = Number(userMoney) + (multiplier * valAsNum);
            }
            else
                newMoneyValue = Number(userMoney) - valAsNum;

            // if (newMoneyValue > 1000000000) {
            //     DatabaseHelper.setValue("bailout", message.author.username, "true")
            // }
            if (newMoneyValue > Number.MAX_SAFE_INTEGER) {
                message.reply("Du har nådd et så høyt tall at programmeringsspråket ikke lenger kan gjøre trygge operasjoner på det. Du kan fortsette å gamble, men noen funksjoner kan virke ustabile")
            }
            DatabaseHelper.setValue("chips", message.author.id, newMoneyValue.toFixed(2))

            const gambling = new MessageEmbed()
                .setTitle("Gambling 🎲")
                .setDescription(`${message.author.username} gamblet ${valAsNum} av ${userMoney} chips.\nTerningen trillet: ${roll}/100. Du ${roll >= 50 ? "vant! 💰💰 (" + (Number(multiplier) + 1) + "x)" : "tapte 💸"}\nDu har nå ${newMoneyValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} chips.`)
            if (roll >= 100)
                gambling.addField(`Trillet 100!`, `Du trillet 100 og vant ${multiplier + 1} ganger så mye som du satset!`)
            MessageHelper.sendFormattedMessage(message, gambling);
        }
    }
    static getMultiplier(roll: number, amountBet: number) {
        if (roll >= 100)
            return 5;
        if (roll >= 95)
            return 1;
        if (roll >= 85)
            return 0.87;
        if (roll >= 75)
            return 0.7
        if (roll >= 60)
            return 0.45
        if (roll >= 51)
            return 0.25
        return 1;
    }

    static bailout(message: Message) {
        const canBailout = false
        const userCoins = DatabaseHelper.getValue("chips", message.author.id, message)
        // if(canBailout === "true" && Number(userCoins) < 100000){
        //     message.reply(`${message.author.username} har mottatt en redningspakke fra MazariniBank på 500,000,000.`)
        //     DatabaseHelper.setValue("dogeCoin", message.author.username, "500000000");
        // } else {
        message.reply("Beklager, MazariniBank gir ikke ut redningspakker.")
        // }
    }

    static takeUpLoan(message: Message, content: string, args: string[]) {
        let amountToLoan = 500;
        if (args[0]) {
            const argAsNum = Number(args[0])

            if (isNaN(argAsNum)) {
                message.reply("du har oppgitt et ugyldig tall")
                return;
            } else if (argAsNum > 250) {
                message.reply("du kan låne maks 250 chips")
                return;
            } else if (argAsNum < 1) {
                message.reply("Kan kje låna mindre enn 1 chip")
                return;
            }
            amountToLoan = argAsNum;
        }
        const userId = message.author.id;
        const totalLoans = DatabaseHelper.getValue("loanCounter", userId, message)
        const totalDebt = DatabaseHelper.getValue("debt", userId, message)
        const userMoney = DatabaseHelper.getValue("chips", message.author.id, message);
        if (totalDebt > 1500) {
            message.reply("Du har for mye gjeld. Betal ned litt før du tar opp nytt lån. (Hvis du har 0 chips nå e du pretty fucked, for Arne har ikkje koda inn någe redning her ennå)")
            return;
        }
        const newTotalLoans = Number(totalLoans) + 1;
        const newDebt = (Number(totalDebt) + amountToLoan) * 1.1;

        DatabaseHelper.setValue("loanCounter", userId, newTotalLoans.toString())
        DatabaseHelper.setValue("debt", userId, newDebt.toFixed(2))
        const newCoinsVal = Number(userMoney) + amountToLoan;
        DatabaseHelper.setValue("chips", userId, newCoinsVal.toFixed(2))

        MessageHelper.sendMessage(message, `${userId}, du har nå lånt ${amountToLoan.toFixed(2)} chips med 10% rente. Spend them well. Din totale gjeld er nå: ${newDebt.toFixed(2)} (${newTotalLoans} lån gjort)`)
    }

    static payDownDebt(message: Message, content: string, args: string[]) {
        const userId = message.author.id;
        const totalDebt = DatabaseHelper.getValue("debt", userId, message)
        if (Number(totalDebt) <= 0) {
            message.reply("Du har ingen lån")
            return;
        }
        const userMoney = DatabaseHelper.getValue("chips", message.author.id, message);
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
                DatabaseHelper.setValue("debt", userId, newTotal.toFixed(2))
                const newDogeCoinsCOunter = Number(userMoney) - wantsToPayDownThisAmount + backToPayer;
                DatabaseHelper.setValue("chips", userId, newDogeCoinsCOunter.toFixed(2))
                MessageHelper.sendMessage(message, `Du har nå betalt ned ${wantsToPayDownThisAmount.toFixed(2)} av lånet ditt på ${totalDebt}. Lånet er nå på ${newTotal.toFixed(2)} og du har ${newDogeCoinsCOunter.toFixed(2)} chips igjen.`)
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
        if (isNaN(Number(args[1]))) {
            userWhoGetsCoins = args[0] + " " + args[1];
            coinsToVipps = args[2];
        }
        if (Number(coinsToVipps) < 1) {
            message.reply("Må vippse minst 1 coin, bro")
            return;
        }

        const authorBalance = Number(DatabaseHelper.getValue("dogeCoin", message.author.id, message));
        if (authorBalance >= Number(coinsToVipps)) {
            //go ahead
            if (DatabaseHelper.findUserByUsername(userWhoGetsCoins, message)) {
                const newBalance = authorBalance - Number(coinsToVipps);
                DatabaseHelper.setValue("dogeCoin", message.author.id, newBalance.toFixed(2))
                DatabaseHelper.incrementValue("dogeCoin", userWhoGetsCoins, coinsToVipps, message);
                MessageHelper.sendMessage(message, `${message.author.id} vippset ${userWhoGetsCoins} ${coinsToVipps}.`)

            } else {
                message.reply("finner ingen bruker med det navnet")
            }
        } else {
            message.reply("du har ikkje råd te å vippsa så møye, bro (Man kan ikkje vippsa chips for gambling).")
        }

    }
    static dealCoins(message: Message, value: string, peopleGettingCoins: string, numP: number, noDefaultPott?: boolean) {
        const peopleCoins = peopleGettingCoins.split(",").filter(u => u !== "Mazarini Bot")
        const basePot = noDefaultPott ? 0 : 50;
        let pot = basePot;
        const val = Number(value);
        pot += val * numP;
        const shareOfCoins = pot / peopleCoins.length;
        let moneyString = "";
        peopleCoins.forEach((username) => {
            if (!!username.trim()) {
                const currentUser = DatabaseHelper.findUserByUsername(username, message)
                if (currentUser) {

                    const userCoins = DatabaseHelper.getValue("chips", currentUser?.id, message) as number;
                    const newValue = Number(userCoins) + Number(shareOfCoins.toFixed(0));
                    if (isNaN(newValue) || isNaN(userCoins)) {
                        message.reply("en av verdiene fra databasen kan ikke konverteres til et tall. newValue: '" + newValue + "', userCoins: '" + userCoins + "'. Hendelsen blir loggført slik at en nerd kan se nærmere på det.")
                        MessageHelper.sendMessageToActionLogWithDefaultMessage(message, `Trigget dealcoins med enten undefined eller NaN verdi på coins. `)
                    }
                    DatabaseHelper.setValue("chips", currentUser?.id, newValue.toString());
                    moneyString += `${username}: ${userCoins} -> ${newValue}\n`
                }
            }
        });
        MessageHelper.sendMessage(message, moneyString)
    }


    static async checkCoins(message: Message, messageContent: string, args: string[]) {
        let username: string;
        if (!args[0]) {
            username = message.author.username;
        } else
            username = getUsernameInQuotationMarks(messageContent) ?? args[0];
        const user = DatabaseHelper.findUserByUsername(username, message);
        if (!user) {
            message.reply("Fant ikke brukeren")
            return;
        }
        const val = DatabaseHelper.getValue("dogeCoin", user.id, message)
        MessageHelper.sendMessage(message, `${username} har ${Number(val).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} coins`)
    }
    static async checkChips(message: Message, messageContent: string, args: string[]) {
        let username;
        if (!args[0]) {
            username = message.author.username;
        } else
            username = getUsernameInQuotationMarks(messageContent) ?? args[0];
        const user = DatabaseHelper.findUserByUsername(username, message);
        if (!user) {
            message.reply("Fant ikke brukeren")
            return;
        }
        const val = DatabaseHelper.getValue("chips", user.id, message)
        MessageHelper.sendMessage(message, `${username} har ${Number(val).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} chips`)
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
        description: "Lån chips fra banken",

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
        description: "Gambla coinså dine! Skriv inn mengde coins du vil gambla, så kan du vinna. Tilbakebetaling blir høyere jo høyere terningen triller (1.1x for 50 opp till 5x for 100)",

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
        description: "Se antall coins til en person",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.checkCoins(rawMessage, messageContent, args);
        }
    }
    static readonly checkChipsCommand: ICommandElement = {
        commandName: "chips",
        description: "Se antall chips en person har til gambling",
        command: (rawMessage: Message, messageContent: string, args: string[]) => {
            GamblingCommands.checkChips(rawMessage, messageContent, args);
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