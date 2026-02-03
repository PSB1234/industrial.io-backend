// Room status storage
const roomStatuses = new Map<string, string>();

export function setRoomStatus(roomKey: string, status: string): void {
	roomStatuses.set(roomKey, status);
}

export function getRoomStatus(roomKey: string): string | undefined {
	return roomStatuses.get(roomKey);
}

export function deleteRoomStatus(roomKey: string): void {
	roomStatuses.delete(roomKey);
}
