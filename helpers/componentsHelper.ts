import { ActionRowBuilder } from '@discordjs/builders'
import { FileBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SectionBuilder, SeparatorBuilder, TextDisplayBuilder } from 'discord.js'

export class ComponentsHelper {
    static createTextComponent() {
        return new TextDisplayBuilder()
    }

    static createSectionComponent() {
        return new SectionBuilder()
    }

    static createMediaGalleryComponent() {
        return new MediaGalleryBuilder()
    }

    static createMediaItemComponent() {
        return new MediaGalleryItemBuilder()
    }

    static createFileComponent() {
        return new FileBuilder()
    }

    static createSeparatorComponent() {
        return new SeparatorBuilder()
    }

    static createActionRowComponent() {
        return new ActionRowBuilder()
    }
}
