
import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message } from "discord.js";
import { ICommandElement } from "./commands/commands";
import { MessageHelper } from "./helpers/messageHelper";
export class PatchNotes {

    /** Version x.y.z
     * Increment x for store oppdateringer (inkl. endringer med breaking changes, større refactoring osv.)
     * Increment y for mindre oppdateringer (enkle funksjoner osv)
     * Increment z for bugfixes, mindre tekstendringer, sannsynlighetsendringer etc
     */
    public static readonly currentVersion = "2.5.6";

    /** Private, brukes kun av getCurrentPatchNotes */
    private static readonly header = "Patch notes for versjon " + PatchNotes.currentVersion;

    /** Separer hver linje med \n (linebreak), og start med en stjerne (*). Skriv generelt hva som er endret
     * Eks: Senket sannsynligheten for å få høye tall på spinneren
     * Ikke: Endret sannsynligheten for å få 10 på spinner fra 0.001 til 0.0025, og 9 fra 0.002 til 0.0025 		osv. 
     */
    public static readonly currentPatchNotes: string
        = "* Fikser problemer med resolving av veddemål. Bot Høie teller heller ikke lenger med i listen."
        + "\n* Fikser potten i veddemål. Coins blir nå korrekt trukket av deltakere i det veddemålet er startet, og pottet ganges nå korrekt. "
        + "\n* Veddemål uten deltakere går ikke lenger gjennom."
        + "\n* Langt til ekstra logging ved feil i gambling-kommandoer"
        // + "\n* '!mz musikk' er ikke lenger admin-only. (Krever Last.fm-bruker) - her kan du få hentet statistikk fra Last.fm, inkludert topp artist/sang/album og weekly stats"
        // + "\n* Kommandoer er nå case insensetive "
        // + "\n* Ved en senere a"
        // + "\n*Tekniske Notes*" //Kommenter ut denne og det under hvis det ikke er noen tekniske notes
        // + "\n Nye metoder for betaling av lån og andre uten message-objekt" //Kommenter ut denne og det under hvis det ikke er noen tekniske notes

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
        }
    }

    static readonly publishPatchNotes: ICommandElement = {
        commandName: "publishnotes",
        description: "Vis nyligste patch notes",
        hideFromListing: true,
        isAdmin: true,
        command: (rawMessage: Message, messageContent: string) => {
            const pn = PatchNotes.getCurrentPatchNotes();
            MessageHelper.sendMessageToSpecificChannel("802716150484041751", pn, rawMessage.channel as TextChannel)
        }
    }
}