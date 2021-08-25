export interface shopItem {
    name: string;
    description: string;
    price: number;
}
export namespace Shop {
    export const items: shopItem[] = [
        { name: "Eivinds dildo", description: "Dennne vil du ikkje røra", price: 6969 },
        { name: "Shot - sterk", description: "Minst 32%", price: 99 },
        { name: "Shot - svak", description: "Minst 12%", price: 199 },
        { name: "Chug", description: "Minst 0,4l", price: 299},
        { name: "Timeout", description: "Mute-hammer en valgfri person", price: 1337}
    ]

}