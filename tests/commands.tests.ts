import { expect } from 'chai'
import { describe, it } from 'mocha'
import { Commands } from '../general/commands'
import { MazariniBot } from '../main'

describe('Commands test', () => {
    it('Should not have duplicate command names', () => {
        const client = new MazariniBot().testContext()
        const commands = new Commands(client.client)
        expect(
            commands
                .getAllInteractionCommands()
                .map((c) => c.commands.interactionCommands)
                .every((e, i, a) => a.indexOf(e) === i)
        ).to.be.true
        //make sure client is logged out from session on test finish
        client.client.destroy()
    })
})
