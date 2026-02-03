// Room properties storage
const roomProperties = new Map<string, Map<string, Map<number, number>>>();

export const assignProperty = (
	roomKey: string,
	userId: string,
	propertyId: number,
	rank = 0,
): void => {
	if (!roomProperties.has(roomKey)) {
		roomProperties.set(roomKey, new Map());
	}

	const propertiesMap = roomProperties.get(roomKey)!;
	if (!propertiesMap.has(userId)) {
		propertiesMap.set(userId, new Map());
	}

	propertiesMap.get(userId)!.set(propertyId, rank);
};

export const getPlayerProperties = (
	roomKey: string,
	userId: string,
): Set<number> => {
	const propertiesMap = roomProperties.get(roomKey);
	const userProperties = propertiesMap?.get(userId);
	return userProperties ? new Set(userProperties.keys()) : new Set();
};

export const getPlayerPropertiesWithRanks = (
	roomKey: string,
	userId: string,
): { id: number; rank: number }[] => {
	const propertiesMap = roomProperties.get(roomKey);
	const userProperties = propertiesMap?.get(userId);
	if (!userProperties) return [];
	return Array.from(userProperties.entries()).map(([id, rank]) => ({
		id,
		rank,
	}));
};

export const upgradeProperty = (
	roomKey: string,
	userId: string,
	propertyId: number,
): void => {
	const propertiesMap = roomProperties.get(roomKey);
	const userProperties = propertiesMap?.get(userId);
	const currentRank = userProperties?.get(propertyId);
	if (userProperties && currentRank !== undefined && currentRank < 5) {
		userProperties.set(propertyId, currentRank + 1);
	}
};

export const getPropertyRank = (
	roomKey: string,
	userId: string,
	propertyId: number,
): number => {
	const propertiesMap = roomProperties.get(roomKey);
	return propertiesMap?.get(userId)?.get(propertyId) || 0;
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
