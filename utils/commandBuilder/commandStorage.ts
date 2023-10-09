import { jailCommand } from './commandStorage/jail'
import { jailbreakCommand } from './commandStorage/jailbreak'
import { memeCommand } from './commandStorage/meme'
import { musikkCommand } from './commandStorage/musikk'
import { pickpocketCommand } from './commandStorage/pickpocket'
import { rollCommand } from './commandStorage/roll'
import { stoppCommand } from './commandStorage/stopp'

/** Easy way to get commands out from storage.
 * Commands are stored so that they can easily be recreated/updated, and not have to be copied each time.
 * If you want to update a command, just update the values in storage and run createSlashCommand() again.
 */
export namespace CommandStorage {
    export const MemeCommand = memeCommand
    export const RollCommand = rollCommand
    export const MusicCommand = musikkCommand
    export const StoppCommand = stoppCommand
    export const PickpocketCommand = pickpocketCommand
    export const JailbreakCommand = jailbreakCommand
    export const JailCommand = jailCommand
}
