
import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message } from "discord.js";
import { ICommandElement } from "./commands/commands";
import { MessageHelper } from "./helpers/messageHelper";
export class PatchNotes {

    /** Version x.y.z
     * Increment x for store oppdateringer (inkl. endringer med breaking changes, større refactoring osv.)
     * Increment y for mindre oppdateringer (enkle funksjoner osv)
     * Increment z for bugfixes, mindre tekstendringer, sannsynlighetsendringer etc
     */
    public static readonly currentVersion = "2.9.3";

    /** Private, brukes kun av getCurrentPatchNotes */
    private static readonly header = "Patch notes for versjon " + PatchNotes.currentVersion;

    /** Separer hver linje med \n (linebreak), og start med en stjerne (*). Skriv generelt hva som er endret
     * Eks: Senket sannsynligheten for å få høye tall på spinneren
     * Ikke: Endret sannsynligheten for å få 10 på spinner fra 0.001 til 0.0025, og 9 fra 0.002 til 0.0025 		osv. 
     */
    public static readonly currentPatchNotes: string
        = `* ThomasW har fått superadmin-tilgang`
        + "\n * Du kan nå se aktive bets med !mz visbet"
        + "\n * Oddsen på gamble er økt til 2x igjen, i vente på ny algoritme"
        + "\n * Fikset et kræsj når botten skulle minne om spin resett"
        + "\n * '!mz deletemessage' sletter nå også trigger-meldingen"
        + "\n * Du kan ikke lenger ha linebreaks i statusene dine (blir erstattet med mellomrom)"
        + "\n * Ukens spinner-vinner får nå +1000 chips. Ukens taper mister 500. "
        + "\n * Fikset en liten feil i messagehelper som kunne føre til kræsj."
        + "\n * Jærsk-ifyer lagt til '!mz jærsk <text|id>."
        + "\n * setvalue (superadmin) reagerer nå med emoji for feedback."

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