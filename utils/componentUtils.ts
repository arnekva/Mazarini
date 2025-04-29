import { ContainerBuilder } from 'discord.js'

export class ComponentUtils {
    static createContainerBuilder(): ContainerBuilder {
        const component = new ContainerBuilder()
        return component
    }
}
