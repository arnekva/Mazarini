import { LudoColor, LudoPiece } from './ludo'

export namespace LudoBoard {
    export const board = (pieces: LudoPiece[]) => {
        const emojiArray = [
            ['⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛'],
            ['⬛', '🟨', '🟨', '🟨', '🟨', '🟨', '🟨', '🟨', '⬜', '⬜', '⬜', '🟩', '🟩', '🟩', '🟩', '🟩', '🟩', '🟩', '⬛'],
            ['⬛', '🟨', '⬛', '⬛', '⬛', '⬛', '⬛', '🟨', '⬜', '🟩', '🟩', '🟩', '⬛', '⬛', '⬛', '⬛', '⬛', '🟩', '⬛'],
            ['⬛', '🟨', '⬛', '⬜', '⬛', '⬜', '⬛', '🟨', '⬜', '🟩', '⬜', '🟩', '⬛', '⬜', '⬛', '⬜', '⬛', '🟩', '⬛'],
            ['⬛', '🟨', '⬛', '⬛', '⬛', '⬛', '⬛', '🟨', '⬜', '🟩', '⬜', '🟩', '⬛', '⬛', '⬛', '⬛', '⬛', '🟩', '⬛'],
            ['⬛', '🟨', '⬛', '⬜', '⬛', '⬜', '⬛', '🟨', '⬜', '🟩', '⬜', '🟩', '⬛', '⬜', '⬛', '⬜', '⬛', '🟩', '⬛'],
            ['⬛', '🟨', '⬛', '⬛', '⬛', '⬛', '⬛', '🟨', '⬜', '🟩', '⬜', '🟩', '⬛', '⬛', '⬛', '⬛', '⬛', '🟩', '⬛'],
            ['⬛', '🟨', '🟨', '🟨', '🟨', '🟨', '🟨', '🟨', '⬛', '🟩', '⬛', '🟩', '🟩', '🟩', '🟩', '🟩', '🟩', '🟩', '⬛'],
            ['⬛', '⬜', '🟨', '⬜', '⬜', '⬜', '⬜', '⬛', '⬛', '⬛', '⬛', '⬛', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '⬛'],
            ['⬛', '⬜', '🟥', '🟥', '🟥', '🟥', '🟥', '🟥', '⬛', '⬛', '⬛', '🟦', '🟦', '🟦', '🟦', '🟦', '🟦', '⬜', '⬛'], //TODO: Fix red->yellow
            ['⬛', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '⬛', '⬛', '⬛', '⬛', '⬛', '⬜', '⬜', '⬜', '⬜', '🟦', '⬜', '⬛'],
            ['⬛', '🟥', '🟥', '🟥', '🟥', '🟥', '🟥', '🟥', '⬛', '🟥', '⬛', '🟦', '🟦', '🟦', '🟦', '🟦', '🟦', '🟦', '⬛'],
            ['⬛', '🟥', '⬛', '⬛', '⬛', '⬛', '⬛', '🟥', '⬜', '🟥', '⬜', '🟦', '⬛', '⬛', '⬛', '⬛', '⬛', '🟦', '⬛'],
            ['⬛', '🟥', '⬛', '🟥', '⬛', '🟥', '⬛', '🟥', '⬜', '🟥', '⬜', '🟦', '⬛', '🟦', '⬛', '🟦', '⬛', '🟦', '⬛'],
            ['⬛', '🟥', '⬛', '⬛', '⬛', '⬛', '⬛', '🟥', '⬜', '🟥', '⬜', '🟦', '⬛', '⬛', '⬛', '⬛', '⬛', '🟦', '⬛'],
            ['⬛', '🟥', '⬛', '🟥', '⬛', '🟥', '⬛', '🟥', '⬜', '🟥', '⬜', '🟦', '⬛', '🟦', '⬛', '🟦', '⬛', '🟦', '⬛'],
            ['⬛', '🟥', '⬛', '⬛', '⬛', '⬛', '⬛', '🟥', '🟥', '🟥', '⬜', '🟦', '⬛', '⬛', '⬛', '⬛', '⬛', '🟦', '⬛'],
            ['⬛', '🟥', '🟥', '🟥', '🟥', '🟥', '🟥', '🟥', '⬜', '⬜', '⬜', '🟦', '🟦', '🟦', '🟦', '🟦', '🟦', '🟦', '⬛'],
            ['⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛'],
        ]

        pieces.forEach((piece) => {
            if (piece?.positionIndex > 52 && piece.positionIndex < 100) {
                console.log('a piece was stuck between 52 and 100', piece.positionIndex)

                piece.positionIndex = piece.positionIndex - 52
            }
            const pos = LudoBoard.indexMap[piece.positionIndex]
            if (piece.color === 'yellow') console.log(piece.positionIndex)

            emojiArray[pos[0]][pos[1]] = LudoBoard.findSquare(piece.color)
        })

        return {
            board1: emojiArray
                .slice(0, 8)
                .map((row) => row.join(''))
                .join('\n'),
            board2: emojiArray
                .slice(8, 11)
                .map((row) => row.join(''))
                .join('\n'),
            board3: emojiArray
                .slice(11)
                .map((row) => row.join(''))
                .join('\n'),
        }
    }

    export const findSquare = (c: LudoColor) => {
        if (c === 'red') return '🟥'
        if (c === 'blue') return '🟦'
        if (c === 'green') return '🟩'
        if (c === 'yellow') return '🟨'
    }

    export const indexMap = {
        0: [1, 8],
        1: [1, 9],
        2: [1, 10],
        3: [2, 10],
        4: [3, 10],
        5: [4, 10],
        6: [5, 10],
        7: [6, 10],
        8: [8, 12],
        9: [8, 13],
        10: [8, 14],
        11: [8, 15],
        12: [8, 16],
        13: [8, 17],
        14: [9, 17],
        15: [10, 17],
        16: [10, 16],
        17: [10, 15],
        18: [10, 14],
        19: [10, 13],
        20: [10, 12],
        21: [12, 10],
        22: [13, 10],
        23: [14, 10],
        24: [15, 10],
        25: [16, 10],
        26: [17, 10],
        27: [17, 9],
        28: [17, 8],
        29: [16, 8],
        30: [15, 8],
        31: [14, 8],
        32: [13, 8],
        33: [12, 8],
        34: [10, 6],
        35: [10, 5],
        36: [10, 4],
        37: [10, 3],
        38: [10, 2],
        39: [10, 1],
        40: [9, 1],
        41: [8, 1],
        42: [8, 2],
        43: [8, 3],
        44: [8, 4],
        45: [8, 5],
        46: [8, 6],
        47: [6, 8],
        48: [5, 8],
        49: [4, 8],
        50: [3, 8],
        51: [2, 8],
        52: [1, 8],

        //100 = Yellow
        100: [3, 3],
        101: [3, 5],
        102: [5, 3],
        103: [5, 5],

        //Yellow start
        105: [8, 3],
        //Yellow board end
        106: [9, 1],
        //Yellow goal path
        110: [9, 2],
        111: [9, 3],
        112: [9, 4],
        113: [9, 5],
        114: [9, 6],
        //Yellow goal
        115: [9, 7],

        //200 = Green
        200: [3, 13],
        201: [3, 15],
        202: [5, 13],
        203: [5, 15],
    }

    export const pieceStartPosition = (color: LudoColor) => {
        switch (color) {
            case 'yellow':
                return 43
            case 'green':
                return 1
            case 'blue':
                return 1
            case 'red':
                return 1
        }
    }

    export const endStates = (color: LudoColor) => {
        switch (color) {
            case 'yellow':
                return 106
            case 'green':
                return 206
            case 'blue':
                return 306
            case 'red':
                return 406
        }
    }
    export const endPathStart = (color: LudoColor) => {
        switch (color) {
            case 'yellow':
                return 40
            case 'green':
                return 1
            case 'blue':
                return 1
            case 'red':
                return 1
        }
    }

    export const normalPathToEndPath = (color: LudoColor) => {
        switch (color) {
            case 'yellow':
                return 110
            case 'green':
                return 210
            case 'blue':
                return 310
            case 'red':
                return 410
        }
    }
    export const goalForColor = (color: LudoColor) => {
        switch (color) {
            case 'yellow':
                return 115
            case 'green':
                return 215
            case 'blue':
                return 315
            case 'red':
                return 415
        }
    }

    export const homeIndexes = (color: LudoColor) => {
        switch (color) {
            case 'yellow':
                return [100, 101, 102, 103]
            case 'green':
                return [200, 201, 202, 203]
            case 'blue':
                return [300, 301, 302, 303]
            case 'red':
                return [400, 401, 402, 403]
        }
    }
}
