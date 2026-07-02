/**
 * Registers the /værmelding global slash command and removes the old /weather one.
 * Uses the REST API directly (no gateway login) so it won't disturb the running bot.
 *   npx ts-node scripts/registerVaermelding.ts
 */
import 'dotenv/config'
import { REST } from 'discord.js'
import { discordAppId, discordSecret } from '../client-env'
import { CommandStorage } from '../builders/commandBuilder/commandStorage'

const item = CommandStorage.Vaermelding
const body = {
    name: item.commandName,
    description: item.commandDescription,
    options: (item.options ?? []).map((o: any) => ({ type: o.type, name: o.name, description: o.description, required: !!o.required })),
}

const rest = new REST({ version: '10' }).setToken(discordSecret)
const base = `/applications/${discordAppId}/commands` as `/${string}`

async function run() {
    console.log('Registering global command:', JSON.stringify(body))
    const created: any = await rest.post(base, { body })
    console.log(`✓ Registered /${created.name} (id ${created.id})`)

    const all: any[] = (await rest.get(base)) as any[]
    const old = all.find((c) => c.name === 'weather')
    if (old) {
        await rest.delete(`${base}/${old.id}` as `/${string}`)
        console.log(`✓ Deleted old /weather (id ${old.id})`)
    } else {
        console.log('No old /weather command found (already gone).')
    }
    console.log('Done. Global commands can take a little while to propagate in clients.')
    process.exit(0)
}

run().catch((e) => {
    console.error('Failed:', e?.rawError ?? e)
    process.exit(1)
})
