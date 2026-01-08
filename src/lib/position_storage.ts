// Room position storage
const roomPositions = new Map<string, Map<string, number>>();

export const assignPosition = (
	roomKey: string,
	userId: string,
	currentPosition = 0,
): number => {
	if (!roomPositions.has(roomKey)) {
		roomPositions.set(roomKey, new Map());
	}

	const positions = roomPositions.get(roomKey)!;
	const existingPosition = positions.get(userId);

	if (existingPosition !== undefined) return existingPosition;

	positions.set(userId, currentPosition);
	return currentPosition;
};

export const updatePosition = (
	roomKey: string,
	userId: string,
	newPosition: number,
) => {
	if (!roomPositions.has(roomKey)) {
		roomPositions.set(roomKey, new Map());
	}
	const positions = roomPositions.get(roomKey)!;
	positions.set(userId, newPosition);
};

export const removePosition = (roomKey: string, userId: string) => {
	roomPositions.get(roomKey)?.delete(userId);
};

export const clearRoomPositions = (roomKey: string) => {
	roomPositions.delete(roomKey);
};
