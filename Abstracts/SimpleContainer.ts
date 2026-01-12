import { APIComponentInContainer, ContainerBuilder, ContainerComponentBuilder, RGBTuple, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js'
import { ComponentsHelper } from '../helpers/componentsHelper'

export interface ContainerComponent {
    name: string
    component: APIComponentInContainer | ContainerComponentBuilder
}

export class SimpleContainer {
    private customContainer: ContainerBuilder
    private components: ContainerComponent[]

    constructor() {
        this.customContainer = new ContainerBuilder()
        this.components = new Array<ContainerComponent>()
    }

    public addComponent(component: APIComponentInContainer | ContainerComponentBuilder, reference: string, index?: number) {
        const insert = index ?? this.customContainer.components?.length ?? 0
        this.customContainer.spliceComponents(insert, 0, component)
        this.components.splice(insert, 0, { name: reference, component: component })
    }

    public addComponentAfterReference(reference: string, component: APIComponentInContainer | ContainerComponentBuilder, afterRef: string) {
        const insert = this.getComponentIndex(afterRef) + 1 ?? this.customContainer.components?.length ?? 0
        this.customContainer.spliceComponents(insert, 0, component)
        this.components.splice(insert, 0, { name: reference, component: component })
    }

    public removeComponent(reference: string) {
        const index = this.components.findIndex((comp) => comp.name === reference)
        if (index >= 0) {
            this.customContainer.spliceComponents(index, 1)
            this.components.splice(index, 1)
        }
    }

    public replaceComponent(reference: string, newComponent: APIComponentInContainer | ContainerComponentBuilder) {
        const index = this.components.findIndex((comp) => comp.name === reference)
        if (index >= 0) {
            this.customContainer.spliceComponents(index, 1, newComponent)
            this.components[index].component = newComponent
        }
    }

    public updateTextComponent(reference: string, newText: string) {
        const index = this.components.findIndex((comp) => comp.name === reference)
        if (index >= 0) {
            const newComponent = ComponentsHelper.createTextComponent().setContent(newText)
            this.customContainer.spliceComponents(index, 1, newComponent)
            this.components[index].component = newComponent
        }
    }

    public getComponentIndex(reference: string) {
        return this.components.findIndex((comp) => comp.name === reference)
    }

    public addSeparator(
        p = {
            spacing: SeparatorSpacingSize.Small,
            divider: true,
            referance: 'separator',
        }
    ) {
        this.addComponent(
            new SeparatorBuilder({
                spacing: p.spacing,
                divider: p.divider,
            }),
            p.referance
        )
    }

    public setColor(color: number | RGBTuple) {
        this.customContainer.setAccentColor(color)
    }

    public getComponent(reference: string) {
        return this.components.find((comp) => comp.name === reference)?.component
    }

    get container() {
        return this.customContainer
    }
}
