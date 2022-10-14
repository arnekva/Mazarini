import { expect } from 'chai'
import { describe, it } from 'mocha'
import { Commands } from '../general/commands'
import { MessageHelper } from '../helpers/messageHelper'
import { MazariniClient } from '../main'

describe('Commands test', () => {
    it('Should not have duplicate command names', () => {
        const client = new MazariniClient().testContext()
        const msg = new MessageHelper(client.client)
        const commands = new Commands(client.client, msg)
        expect(
            commands
                .getAllCommands()
                .map((c) => c.commandName)
                .every((e, i, a) => a.indexOf(e) === i)
        ).to.be.true
        //make sure client is logged out from session on test finish
        client.client.destroy()
    })
})
