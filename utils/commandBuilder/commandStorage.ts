import { memeCommand } from './commandStorage/meme'

/** Easy way to get commands out from storage.
 * Commands are stored so that they can easily be recreated/updated, and not have to be copied each time.
 * If you want to update a command, just update the values in storage and run createSlashCommand() again.
 */
export namespace CommandStorage {
    export const MemeCommand = memeCommand
}
