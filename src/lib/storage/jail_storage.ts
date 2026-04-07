const jailRollAttemptsByRoom = new Map<string, Map<string, number>>();

const getRoomAttempts = (roomKey: string): Map<string, number> => {
	const roomAttempts = jailRollAttemptsByRoom.get(roomKey);
	if (roomAttempts) return roomAttempts;

	const next = new Map<string, number>();
	jailRollAttemptsByRoom.set(roomKey, next);
	return next;
};

export const getJailRollAttempts = (
	roomKey: string,
	userId: string,
): number => {
	return getRoomAttempts(roomKey).get(userId) ?? 0;
};

export const incrementJailRollAttempts = (
	roomKey: string,
	userId: string,
): number => {
	const attempts = getJailRollAttempts(roomKey, userId) + 1;
	getRoomAttempts(roomKey).set(userId, attempts);
	return attempts;
};

export const clearJailRollAttemptsForPlayer = (
	roomKey: string,
	userId: string,
): void => {
	const roomAttempts = jailRollAttemptsByRoom.get(roomKey);
	if (!roomAttempts) return;

	roomAttempts.delete(userId);
	if (roomAttempts.size === 0) {
		jailRollAttemptsByRoom.delete(roomKey);
	}
};

export const clearJailRollAttemptsForRoom = (roomKey: string): void => {
	jailRollAttemptsByRoom.delete(roomKey);
};
