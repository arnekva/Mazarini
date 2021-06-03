
import { Channel, Client, DMChannel, NewsChannel, TextChannel, Message } from "discord.js";
import { ICommandElement } from "./commands/commands";
import { MessageHelper } from "./helpers/messageHelper";
export class PatchNotes {

	/** Version x.y.z
	 * Increment x for store oppdateringer (inkl. endringer med breaking changes, større refactoring osv.)
	 * Increment y for mindre oppdateringer (enkle funksjoner osv)
	 * Increment z for bugfixes, mindre tekstendringer, sannsynlighetsendringer etc
	 */
	public static readonly currentVersion = "2.0.4";

	/** Private, brukes kun av getCurrentPatchNotes */
	private static readonly header = "Patch notes for versjon " + PatchNotes.currentVersion;

	/** Separer hver linje med \n (linebreak), og start med en stjerne (*). Skriv generelt hva som er endret
	 * Eks: Senket sannsynligheten for å få høye tall på spinneren
	 * Ikke: Endret sannsynligheten for å få 10 på spinner fra 0.001 til 0.0025, og 9 fra 0.002 til 0.0025 		osv. 
	 */
	public static readonly currentPatchNotes: string
		= "* Boten kjører nå på en Raspberry Pi"
		+ "\n* Du kan nå ha alle typer emojier i statusen din"
		+ "\n* UwU command er endelig tilbake"
		+ "\n*Tekniske Notes*" //Kommenter ut denne og det under hvis det ikke er noen tekniske notes
		+ "\n* Byttet Database - bruker nå node-json-db, og alle brukere er nå objekter"
		+ "\n* Boten kan nå kjøres i lokale testmiljøer. Du trenger tilgang til github repoet og node installert."
		+ "\n* Metodene i DatabaseHelper skrives om - verdier blir nå returnert i stedet for å ta i bruk callbacks"
		+ "\n* Oppdater til Node v14, som gir mye flere muligheter, blant annet å hente X siste meldinger fra en channel"
		+ "\n* Lagt opp bedre mappestruktur"
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