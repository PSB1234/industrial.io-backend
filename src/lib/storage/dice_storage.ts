const lastDiceByRoom = new Map<string, Map<string, number>>();

const getRoomDice = (roomKey: string): Map<string, number> => {
    const roomDice = lastDiceByRoom.get(roomKey);
    if (roomDice) return roomDice;

    const next = new Map<string, number>();
    lastDiceByRoom.set(roomKey, next);
    return next;
};

export const setLastDiceRoll = (
    roomKey: string,
    userId: string,
    dice: number,
): void => {
    getRoomDice(roomKey).set(userId, dice);
};

export const getLastDiceRoll = (
    roomKey: string,
    userId: string,
): number | null => {
    return getRoomDice(roomKey).get(userId) ?? null;
};

export const clearLastDiceRoll = (roomKey: string, userId: string): void => {
    const roomDice = lastDiceByRoom.get(roomKey);
    if (!roomDice) return;

    roomDice.delete(userId);
    if (roomDice.size === 0) {
        lastDiceByRoom.delete(roomKey);
    }
};
