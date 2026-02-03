// Room money storage
const roomMoney = new Map<string, Map<string, number>>();

export const assignMoney = (
	roomKey: string,
	userId: string,
	defaultMoney = 2500,
): number => {
	if (!roomMoney.has(roomKey)) {
		roomMoney.set(roomKey, new Map());
	}

	const moneyMap = roomMoney.get(roomKey)!;
	const existingMoney = moneyMap.get(userId);

	if (existingMoney !== undefined) return existingMoney;

	moneyMap.set(userId, defaultMoney);
	return defaultMoney;
};

export const getMoney = (roomKey: string, userId: string): number => {
	return roomMoney.get(roomKey)?.get(userId) || 0;
};

export const updateMoney = (
	roomKey: string,
	userId: string,
	newMoney: number,
) => {
	if (!roomMoney.has(roomKey)) {
		roomMoney.set(roomKey, new Map());
	}
	const moneyMap = roomMoney.get(roomKey)!;
	moneyMap.set(userId, newMoney);
};
export const addMoney = (roomKey: string, userId: string, amount: number) => {
	const currentMoney = roomMoney.get(roomKey)?.get(userId) || 0;
	updateMoney(roomKey, userId, currentMoney + amount);
};
export const deductMoney = (
	roomKey: string,
	userId: string,
	amount: number,
) => {
	const currentMoney = roomMoney.get(roomKey)?.get(userId) || 0;
	updateMoney(roomKey, userId, currentMoney - amount);
};
export const removeMoney = (roomKey: string, userId: string) => {
	roomMoney.get(roomKey)?.delete(userId);
};

export const clearRoomMoney = (roomKey: string) => {
	roomMoney.delete(roomKey);
};
