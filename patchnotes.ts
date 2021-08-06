
import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message, MessageFlags } from "discord.js";
import { ICommandElement } from "./commands/commands";
import { MessageHelper } from "./helpers/messageHelper";
export class PatchNotes {

    /** Version x.y.z
     * Increment x for store oppdateringer (inkl. endringer med breaking changes, større refactoring osv.)
     * Increment y for mindre oppdateringer (enkle funksjoner osv)
     * Increment z for bugfixes, mindre tekstendringer, sannsynlighetsendringer etc
     */
    public static readonly currentVersion = "2.10.0";

    /** Private, brukes kun av getCurrentPatchNotes */
    private static readonly header = "Patch notes for versjon " + PatchNotes.currentVersion;

    /** Separer hver linje med \n (linebreak), og start med en stjerne (*). Skriv generelt hva som er endret
     * Eks: Senket sannsynligheten for å få høye tall på spinneren
     * Ikke: Endret sannsynligheten for å få 10 på spinner fra 0.001 til 0.0025, og 9 fra 0.002 til 0.0025 		osv. 
     */
    public static readonly currentPatchNotes: string
        = `* Det finnes ikke lenger maksgjeld på lån. I stedet vil banken begynne å ta en prosentsats av gevinstene dine som renter (øker dersom du tar mere lån når du allerede er i høy gjeld). Disse rentene teller ikke mot gjelden din.`
        + `\n* Tekniske endringer i gambling-kommandoer`
        + `\n* Countdowner blir nå sortert i rekkefølge`
        + `\n* Små endringer på tekster`
        + `\n* Du kan ikke lenger gå negativt i chips når du triller 00:00`
        + `\n* Du får ikke lenger beskjed om at tall mellom 0 og 1 ikke er positive`
        + `\n* Ny funksjon 'stats' for admins som skal vise enkel statistikk for boten siden sist oppstart. Vil foreløpig ikke lagre noe verdier, så alt hentes fra minne`
        ;

    static getCurrentPatchNotes() {
        return PatchNotes.header + "\n" + PatchNotes.currentPatchNotes;
    }

    static readonly getPatchNotes: ICommandElement = {
        commandName: "patch",
        description: "Vis nyligste patch notes",

        command: (rawMessage: Message, messageContent: string) => {
            const pn = PatchNotes.getCurrentPatchNotes();
            MessageHelper.sendMessage(rawMessage, pn)
        },
        category: "annet",
    }

    static readonly publishPatchNotes: ICommandElement = {
        commandName: "publishnotes",
        description: "Vis nyligste patch notes",
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            MessageFlags
            const pn = PatchNotes.getCurrentPatchNotes();
            MessageHelper.sendMessageToSpecificChannel("802716150484041751", pn, rawMessage.channel as TextChannel)
        },
        category: "admin",
    }
}