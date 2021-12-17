import {
    Client,
    CommandInteraction,
    ContextMenuInteraction,
    Message,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    MessageSelectMenu,
    MessageSelectOptionData,
    User,
} from 'discord.js'
import { DatabaseHelper, debuffItem } from '../helpers/databaseHelper'

export interface userShoppingCart {
    cart: shopItem[]
    user: User
}
export interface shopItem {
    name: string
    description: string
    price: number
}
export namespace ShopItems {
    export const items: shopItem[] = [
        { name: 'Eivinds dildo', description: 'Dennne vil du ikkje røra', price: 6969 },
        { name: 'Shot (sterk)', description: 'Minst 32%', price: 99 },
        { name: 'Shot (svak)', description: 'Minst 12%', price: 199 },
        { name: 'Chug', description: 'Minst 0,4l', price: 299 },
        { name: 'Timeout', description: 'Mute-hammer en valgfri person', price: 1337 },
    ]
}

export interface inventoryItem {
    name: string
    description: string
    price: string
    amount: Number
}
export class ShopClass {
    static async openShop(interaction: CommandInteraction, client: Client) {
        let allShoppingCart: userShoppingCart[] = []
        let targetBruker: string
        let shopDescription = 'Velkommen til Mazarini shop, her kan du få kjøpt leketøy til Eivinds mor! \n \n Handleliste:'
        const embed = new MessageEmbed().setColor('#FF0000').setTitle('Mazarini shop!').setDescription(shopDescription)

        let options: MessageSelectOptionData[] = []

        ShopItems.items.forEach((item) => {
            options.push({
                label: `${item.name} (${item.price},-)`,
                description: item.description,
                value: item.name,
            })
        })

        const menu = new MessageSelectMenu().setCustomId('MenyValg').setPlaceholder('Ingen leker valgt!').setMinValues(1).addOptions(options)

        const row1 = new MessageActionRow().addComponents(menu)

        const buyButton = new MessageButton().setCustomId('buy').setLabel('KJØP').setStyle('PRIMARY')

        const priceButton = new MessageButton().setCustomId('blank').setLabel('             ').setStyle('SECONDARY').setDisabled(true)

        const row2 = new MessageActionRow()

        //commandId === /shop
        if (interaction.commandId === '877136476045967361') {
            allShoppingCart.push({
                user: interaction.user,
                cart: [],
            })

            buyButton.setDisabled(true)

            row2.addComponents(buyButton, priceButton, new MessageButton().setCustomId('CANCEL').setLabel('CANCEL').setStyle('DANGER'))

            await interaction.reply({ embeds: [embed], components: [row1, row2], isMessage: true })
        }

        //commandID ==== /inventory
        if (interaction.commandId === '879251024475467807') {
            let inventoryDescription = 'Whalekøm to your inventøry. You currently possess:'
            let debuffDescription = 'Yøur debuffs:'

            let inventoryItems: inventoryItem[] = DatabaseHelper.getValueWithoutMessage('inventory', interaction.user.username)

            if (inventoryItems) {
                Object.values(inventoryItems).forEach((item: inventoryItem) => {
                    if (item.amount > 0) {
                        inventoryDescription = inventoryDescription + '\n' + ' - ' + item.name + ' x' + item.amount
                    }
                })
            }

            let debuffItems: debuffItem[] = DatabaseHelper.getValueWithoutMessage('debuff', interaction.user.username)

            if (debuffItems) {
                Object.values(debuffItems).forEach((debuff: debuffItem) => {
                    if (debuff.amount > 0) {
                        debuffDescription = debuffDescription + '\n' + ' - ' + debuff.item + ' x' + debuff.amount
                    }
                })
            }

            const inventoryEmbed = new MessageEmbed()
                .setColor('#FFC0CB')
                .setTitle(`Your inventøry - ${interaction.user.username}!`)
                .setDescription(inventoryDescription)

            const debuffEmbed = new MessageEmbed()
                .setColor('#800080')
                .setTitle(`Your debuffs - ${interaction.user.username}!`)
                .setDescription(debuffDescription)

            await interaction.reply({ embeds: [inventoryEmbed, debuffEmbed] })
        }

        //commandID === Use Item -> User Command
        if (interaction.commandId === '879333334784823316') {
            const menuInteraction = interaction as ContextMenuInteraction
            const user = client.users.cache.find((user: User) => user.id === menuInteraction.targetId)

            let itemOptions: MessageSelectOptionData[] = []

            let inventoryItems: inventoryItem[] = DatabaseHelper.getValueWithoutMessage('inventory', interaction.user.username)

            Object.values(inventoryItems).forEach((item: inventoryItem) => {
                itemOptions.push({
                    label: `${item.name} x${item.amount}`,
                    description: item.description,
                    value: item.name,
                })
            })

            const itemMenu = new MessageSelectMenu().setCustomId('itemMeny').setPlaceholder('Ingenting valgt!').addOptions(itemOptions)
            if (user) {
                const useEmbeded = new MessageEmbed()
                    .setColor('#00ffe7')
                    .setTitle(`Use item on - ${user.username}!`)
                    .setDescription(`Bruk noe fra lommen din på ${user.username}!`)

                if (user.avatarURL()) useEmbeded.setImage(user.avatarURL() ?? '')

                const rad1 = new MessageActionRow()
                rad1.addComponents(itemMenu)

                targetBruker = user?.username
                await interaction.reply({ embeds: [useEmbeded], components: [rad1] })
            }
        }

        if (interaction.isSelectMenu()) {
            if (interaction.message.interaction?.user == interaction.user) {
                if (interaction.customId == 'itemMeny') {
                    DatabaseHelper.decreaseInventoryItem(interaction.values[0], interaction.user?.username)

                    // DatabaseHelper.increaseDebuff(targetBruker, interaction.values[0])

                    await interaction.update({ content: 'https://i.imgflip.com/5km2hi.jpg', embeds: [], components: [] })
                }

                if (interaction.customId == 'MenyValg') {
                    let shoppingList: shopItem[] = []

                    let price = 0
                    interaction.values.forEach((value) => {
                        const item = this.findItem(value)
                        shoppingList.push(item)
                        shopDescription = shopDescription + '\n - ' + value
                        price = price + Number(item.price)
                    })

                    allShoppingCart[allShoppingCart.findIndex((spesificCart) => spesificCart.user === interaction.user)].cart = shoppingList

                    priceButton.setLabel(String(price) + ',-')

                    embed.setDescription(shopDescription)

                    if (this.checkAvailability(price, interaction.user.username)) {
                        buyButton.setDisabled(false)
                        buyButton.setStyle('SUCCESS')
                    } else {
                        buyButton.setDisabled(true)
                        buyButton.setStyle('PRIMARY')
                    }

                    row2.addComponents(buyButton, priceButton, new MessageButton().setCustomId('CANCEL').setLabel('CANCEL').setStyle('DANGER'))

                    await interaction.update({ embeds: [embed], components: [row1, row2] })
                }
            } else interaction.reply({ content: 'How about no?', ephemeral: true })
        }

        if (interaction.isButton()) {
            if (interaction.message.interaction?.user == interaction.user) {
                if (interaction.customId == 'buy') {
                    let shoppingList: shopItem[] = []
                    shoppingList = allShoppingCart[allShoppingCart.findIndex((spesificCart) => spesificCart.user === interaction.user)].cart

                    let price = 0
                    shoppingList.forEach((value) => {
                        price = price + Number(value.price)
                    })

                    if (this.checkAvailability(price, interaction.user.username)) {
                        DatabaseHelper.setValue(
                            'chips',
                            interaction.user.username,
                            (Number(DatabaseHelper.getValueWithoutMessage('chips', interaction.user.username)) - price).toString()
                        )

                        DatabaseHelper.setShoppingList(interaction.user.username, shoppingList)
                    }

                    await interaction.update({
                        content: 'https://memegenerator.net/img/instances/80586825/thank-you-come-again.jpg',
                        embeds: [],
                        components: [],
                    })
                }
                if (interaction.customId == 'CANCEL') {
                    const melding = (await interaction.message) as Message
                    melding.delete()
                }
            } else interaction.reply({ content: 'How about no?', ephemeral: true })
        }
    }

    static findItem(name: string) {
        return ShopItems.items.filter((item) => item.name === name)[0]
    }

    //Finne ut om bruker har nok penger til kjøp
    static checkAvailability(amount: Number, username: string) {
        return amount < DatabaseHelper.getValueWithoutMessage('chips', username)
    }
}
