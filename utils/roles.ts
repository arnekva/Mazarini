export interface MZRole {
    name: string
    id: string
    emoji: string
}
/** @deprecated use MentionUtils instead */
export namespace Roles {
    /** @deprecated use MentionUtils instead */
    export const allRoles: MZRole[] = [
        { name: 'Battlefield', id: '886600170328952882', emoji: '🖐️' },
        { name: 'Warzone', id: '735253573025267883', emoji: '🙌' },
        { name: 'CoD Multiplayer', id: '1035476337135198238', emoji: '🤙' },
        { name: 'Rocket League', id: '928708534047244400', emoji: '👋' },
    ]
}
