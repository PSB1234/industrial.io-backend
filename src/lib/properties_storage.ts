// Room properties storage
const roomProperties = new Map<string, Map<string, Set<number>>>();

export const assignProperty = (
	roomKey: string,
	userId: string,
	propertyId: number,
): void => {
	if (!roomProperties.has(roomKey)) {
		roomProperties.set(roomKey, new Map());
	}

	const propertiesMap = roomProperties.get(roomKey)!;
	if (!propertiesMap.has(userId)) {
		propertiesMap.set(userId, new Set());
	}

	propertiesMap.get(userId)!.add(propertyId);
};

export const getPlayerProperties = (
	roomKey: string,
	userId: string,
): Set<number> => {
	const propertiesMap = roomProperties.get(roomKey);
	return propertiesMap?.get(userId) || new Set();
};

export const removeProperty = (
	roomKey: string,
	userId: string,
	propertyId: number,
): void => {
	const propertiesMap = roomProperties.get(roomKey);
	propertiesMap?.get(userId)?.delete(propertyId);
};

export const removeAllPlayerProperties = (
	roomKey: string,
	userId: string,
): void => {
	roomProperties.get(roomKey)?.delete(userId);
};

export const clearRoomProperties = (roomKey: string) => {
	roomProperties.delete(roomKey);
};
