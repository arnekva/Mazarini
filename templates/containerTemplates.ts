import { SimpleContainer } from '../Abstracts/SimpleContainer'
import { ComponentsHelper } from '../helpers/componentsHelper'

export const inventoryContainer = () => {
    const container = new SimpleContainer()
    container.addComponent(ComponentsHelper.createTextComponent().setContent('## Inventory'), 'header')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator1')
    container.addComponent(ComponentsHelper.createTextComponent().setContent('Oppdaterer...'), 'common')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator2')
    container.addComponent(ComponentsHelper.createTextComponent().setContent('Oppdaterer...'), 'rare')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator3')
    container.addComponent(ComponentsHelper.createTextComponent().setContent('Oppdaterer...'), 'epic')
    container.addComponent(ComponentsHelper.createSeparatorComponent(), 'separator4')
    container.addComponent(ComponentsHelper.createTextComponent().setContent('Oppdaterer...'), 'legendary')
    return container
}
