import { trelloApiKey, trelloToken } from "../../client-env"
import { TrelloCommands } from "./trelloCommands"
import { INewTrelloCard, ITrelloCard, ITrelloLabel, ITrelloList } from "./trelloInterfaces"

const fetch = require('node-fetch')

export class TrelloAPI {

    static baseUrl = `https://api.trello.com/1/`
    static boardId = '6128df3901a08020e598cd85'
    static backLogId = '6128df3901a08020e598cd86'

    public static async addCard(newCard: INewTrelloCard) {

        const url =
            TrelloCommands.baseUrl +
            `cards?idList=${TrelloCommands.backLogId}&key=${trelloApiKey}&token=${trelloToken}&`
            
        const data = new URLSearchParams({
            name: newCard.name,
            desc: newCard.desc,
        })
        newCard.idLabels.forEach((id) => data.append('idLabels', id))

        const card: ITrelloCard = await fetch(url + data, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
            },
        })
        return card
    }

    public static async updateTrelloCard(card: ITrelloCard) {        
        const url = TrelloCommands.baseUrl +
            `cards/${card.id}?key=${trelloApiKey}&token=${trelloToken}&`

        const data = new URLSearchParams();
        data.append('name', card.name);
        data.append('desc', card.desc);
        data.append('idList', card.idList);
        card.idLabels.forEach((id) => data.append('idLabels', id))
            
        const response: ITrelloCard = await fetch(url + data, {
            method: 'PUT',
            headers: {
                Accept: 'application/json',
            },
        })
        return response
    }

    public static async addCommentToCard(cardId: string, comment: string) {
        const url = TrelloCommands.baseUrl +
        `cards/${cardId}/actions/comments?key=${trelloApiKey}&token=${trelloToken}&`
        
        const data = new URLSearchParams({
            text: comment,
        })

        const card: ITrelloCard = await fetch(url + data, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
            },
        })
        return card
    }

    public static async deleteCard(cardId: string) {
        const url = TrelloCommands.baseUrl +
        `cards/${cardId}?key=${trelloApiKey}&token=${trelloToken}&`

        const card: ITrelloCard = await fetch(url, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
            },
        })
        return card
    }

    public static async retrieveTrelloCards(listId: string) {        
        const url = TrelloCommands.baseUrl +
            `lists/${listId}/cards?key=${trelloApiKey}&token=${trelloToken}`

        const response: Array<ITrelloCard> = await (await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        })).json()

        let cards = new Map<string, ITrelloCard>()
        response.forEach((card) => {                   
            cards.set(card.id, card)
        })  
        return cards      
    }

    public static async retrieveTrelloLabels() {        
        const url = TrelloCommands.baseUrl +
            `boards/${TrelloCommands.boardId}/labels?key=${trelloApiKey}&token=${trelloToken}`

        const response: Array<ITrelloLabel> = await (await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        })).json()
        let labels = new Map<string, ITrelloLabel>()
        response.forEach((label) => {            
            labels.set(label.name.toLowerCase(), label)
        })
        return labels        
    }

    public static async retrieveTrelloLists() {        
        const url = TrelloCommands.baseUrl +
            `boards/${TrelloCommands.boardId}/lists?key=${trelloApiKey}&token=${trelloToken}`

        const response: Array<ITrelloList> = await (await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        })).json()
        let lists = new Map<string, ITrelloList>()
        response.forEach((list) => {    
            lists.set(list.id, list)
        })
        return lists
    }
}