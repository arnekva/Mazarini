export interface MZRole {
    name: string
    id: string
    emoji: string
}
export namespace Roles {
    export const allRoles: MZRole[] = [
        { name: 'Battlefield', id: '886600170328952882', emoji: '🖐️' },
        { name: 'Warzone', id: '735253573025267883', emoji: '🙌' },
        { name: 'Valheim', id: '822999208445083668', emoji: '🤠' },
        { name: 'Insurgency', id: '886600217573621790', emoji: '👋' },
    ]
}
