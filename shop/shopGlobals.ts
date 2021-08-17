export interface shopItem {
    name: string;
    description: string;
    price: string;
}
export namespace Shop {
    export const items: shopItem[] = [
        { name: "Eivinds dildo", description: "Dennne vil du ikkje røra", price: "199" },
        { name: "Shot (sterk)", description: "Minst 32%", price: "99" },
        { name: "Shot (svak)", description: "Minst 12%", price: "199" }
    ]

}