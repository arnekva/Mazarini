
import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message } from "discord.js";
import { ICommandElement } from "./commands/commands";
import { MessageHelper } from "./helpers/messageHelper";
export class PatchNotes {

	/** Version x.y.z
	 * Increment x for store oppdateringer (inkl. endringer med breaking changes, større refactoring osv.)
	 * Increment y for mindre oppdateringer (enkle funksjoner osv)
	 * Increment z for bugfixes, mindre tekstendringer, sannsynlighetsendringer etc
	 */
	public static readonly currentVersion = "2.5.3";

	/** Private, brukes kun av getCurrentPatchNotes */
	private static readonly header = "Patch notes for versjon " + PatchNotes.currentVersion;

	/** Separer hver linje med \n (linebreak), og start med en stjerne (*). Skriv generelt hva som er endret
	 * Eks: Senket sannsynligheten for å få høye tall på spinneren
	 * Ikke: Endret sannsynligheten for å få 10 på spinner fra 0.001 til 0.0025, og 9 fra 0.002 til 0.0025 		osv. 
	 */
	public static readonly currentPatchNotes: string
		= "* Gamblingøkonomien er tilbakestilt. Man har nå chips i stedet for coins, og det er nå maksgrense på lån. Man kan heller ikke vippse chips. Bruk '!mz chips' for å se chips og '!mz wallet' for coins"
		+ "\n* Du kan nå bruke noen funksjoner på folk med mellomrom i brukernavnet. Bruk da \"hermetegn\". Kommandoer som mangler denne funksjonen kan du rapportere i #bot-utvikling channelen"
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