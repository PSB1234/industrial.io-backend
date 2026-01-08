const roomRanks = new Map<string, Map<string, number>>();

export const assignRank = (roomKey: string, userId: string): number => {
	if (!roomRanks.has(roomKey)) {
		roomRanks.set(roomKey, new Map());
	}

	const ranks = roomRanks.get(roomKey)!;
	const existingRank = ranks.get(userId);

	if (existingRank) return existingRank; // Preserve rank on reconnect

	const nextRank = ranks.size + 1;
	ranks.set(userId, nextRank);
	return nextRank;
};

export const removeRank = (roomKey: string, userId: string) => {
	roomRanks.get(roomKey)?.delete(userId);
};

export const clearRoomRanks = (roomKey: string) => {
	roomRanks.delete(roomKey);
};
