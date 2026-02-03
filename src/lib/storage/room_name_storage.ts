const room = new Map<string, string>();

export const getRoomName = (roomKey: string): string | undefined => {
    return room.get(roomKey);
};

export const setRoomName = (roomKey: string, name: string): void => {
    room.set(roomKey, name);
};

export const createRoomName = (roomKey: string, name: string): void => {
    setRoomName(roomKey, name);
};