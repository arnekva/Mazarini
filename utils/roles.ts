export interface MZRole {
    name: string
    id: string
    emoji: string
}
export namespace Roles {
    export const allRoles: MZRole[] = [
        { name: 'Battlefield', id: '886600170328952882', emoji: '🖐️' },
        { name: 'Warzone/COD', id: '735253573025267883', emoji: '🙌' },
        { name: 'Rocket League', id: '928708534047244400', emoji: '👋' },
    ]
}
