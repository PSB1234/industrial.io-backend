const roomVotes = new Map<string, Map<string, Set<string>>>();

export const addVote = (
	roomKey: string,
	targetPlayerId: string,
	voterId: string,
): void => {
	if (!roomVotes.has(roomKey)) {
		roomVotes.set(roomKey, new Map());
	}

	const votes = roomVotes.get(roomKey)!;
	if (!votes.has(targetPlayerId)) {
		votes.set(targetPlayerId, new Set());
	}
	votes.get(targetPlayerId)!.add(voterId);
};

export const removeVote = (
	roomKey: string,
	targetPlayerId: string,
	voterId: string,
): void => {
	const votes = roomVotes.get(roomKey);
	if (!votes) return;

	const playerVotes = votes.get(targetPlayerId);
	if (playerVotes) {
		playerVotes.delete(voterId);
		if (playerVotes.size === 0) {
			votes.delete(targetPlayerId);
		}
	}
};

export const getVotes = (roomKey: string, playerId: string): number => {
	return roomVotes.get(roomKey)?.get(playerId)?.size || 0;
};

export const setVotes = (
	roomKey: string,
	playerId: string,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_count: number,
): void => {
	// With the new Set implementation, we can't arbitrary set a vote count
	// without knowing who the voters are. This function might be deprecated
	// or need a logic rethink if used for resetting.
	// For now, if count is 0, we can clear.
	if (_count <= 0) {
		roomVotes.get(roomKey)?.delete(playerId);
	} else {
		console.warn("setVotes called with non-zero count, not supported in new unique voter system");
	}
};

export const clearPlayerVotes = (roomKey: string, playerId: string): void => {
	roomVotes.get(roomKey)?.delete(playerId);
};

export const clearRoomVotes = (roomKey: string): void => {
	roomVotes.delete(roomKey);
};

export const getAllVotesInRoom = (
	roomKey: string,
): Map<string, number> | undefined => {
	const roomMap = roomVotes.get(roomKey);
	if (!roomMap) return undefined;

	const result = new Map<string, number>();
	for (const [playerId, voters] of roomMap.entries()) {
		result.set(playerId, voters.size);
	}
	return result;
};

export const getVotedPlayers = (
	roomKey: string,
	voterId: string,
): string[] => {
	const roomMap = roomVotes.get(roomKey);
	if (!roomMap) return [];

	const votedPlayers: string[] = [];
	for (const [playerId, voters] of roomMap.entries()) {
		if (voters.has(voterId)) {
			votedPlayers.push(playerId);
		}
	}
	return votedPlayers;
};
