import { Message, VoiceChannel } from "discord.js";

const say = require('say')


export class SoundUtils {

	static sayText(text: string) {
		// https://github.com/Marak/say.js
		say.speak("What's up, dog?", 'Alex', 1.0, (err: string) => {
  if (err) {
    return console.error(err)
  }

  console.log('Text has been spoken.')
});
	}


	static connectToVoiceChannel(message: Message, messageContent: string){
		//TODO: 
		/* Finn channelID fra message 

			Sjekk om channel er VoiceChannel
			Connect til channel (channel.join())
			På callback i sayText disconnect fra Voice
		*/
		const channel = message.channel.client.channels.cache.get("810832760364859432");

	}


}