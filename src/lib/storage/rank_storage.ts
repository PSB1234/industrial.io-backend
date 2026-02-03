const roomRanks = new Map<string, Map<string, number>>();
const roomRankSequence = new Map<string, number>();

export const assignRank = (roomKey: string, userId: string): number => {
	if (!roomRanks.has(roomKey)) {
		roomRanks.set(roomKey, new Map());
		roomRankSequence.set(roomKey, 0);
	}

	const ranks = roomRanks.get(roomKey)!;
	const existingRank = ranks.get(userId);

	if (existingRank) return existingRank; // Preserve rank on reconnect

	// Get the last assigned rank and increment it
	const lastRank = roomRankSequence.get(roomKey) || 0;
	const nextRank = lastRank + 1;

	// Update the sequence and the player's rank
	roomRankSequence.set(roomKey, nextRank);
	ranks.set(userId, nextRank);
	return nextRank;
};

export const removeRank = (roomKey: string, userId: string) => {
	roomRanks.get(roomKey)?.delete(userId);
};

export const clearRoomRanks = (roomKey: string) => {
	roomRanks.delete(roomKey);
	roomRankSequence.delete(roomKey);
};
