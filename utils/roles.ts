export interface MZRole {
    name: string
    id: string
    emoji: string
}
export namespace Roles {
    export const allRoles: MZRole[] = [
        { name: 'Battlefield', id: '886600170328952882', emoji: '🖐️' },
        { name: 'Warzone', id: '735253573025267883', emoji: '🙌' },
        { name: 'Rocket League', id: '928708534047244400', emoji: '👋' },
        // { name: 'Insurgency', id: '886600217573621790', emoji: '👋' },
    ]
}
