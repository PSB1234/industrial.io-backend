const roomTurns = new Map<string, number>();

export const getTurn = (roomKey: string): number => {
    if (!roomTurns.has(roomKey)) {
        roomTurns.set(roomKey, 1); // Start with turn 1 (Rank 1)
    }
    return roomTurns.get(roomKey)!;
};

export const setTurn = (roomKey: string, turn: number) => {
    roomTurns.set(roomKey, turn);
};

export const removeTurn = (roomKey: string) => {
    roomTurns.delete(roomKey);
};
