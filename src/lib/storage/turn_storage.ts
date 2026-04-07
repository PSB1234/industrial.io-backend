const roomTurnCounts = new Map<string, number>();

export const getTurnCount = (roomKey: string): number => {
	return roomTurnCounts.get(roomKey) ?? 0;
};

export const incrementTurnCount = (roomKey: string): number => {
	const nextTurnCount = getTurnCount(roomKey) + 1;
	roomTurnCounts.set(roomKey, nextTurnCount);
	return nextTurnCount;
};

export const clearTurnCount = (roomKey: string): void => {
	roomTurnCounts.delete(roomKey);
};
