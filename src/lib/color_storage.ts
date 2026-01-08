const roomColors = new Map<string, Map<string, string>>();

export const assignColor = (
    roomKey: string,
    userId: string,
    color: string,
): string => {
    if (!roomColors.has(roomKey)) {
        roomColors.set(roomKey, new Map());
    }

    const colors = roomColors.get(roomKey)!;
    colors.set(userId, color);

    return color;
};

export const removeColor = (roomKey: string, userId: string) => {
    roomColors.get(roomKey)?.delete(userId);
};

export const clearRoomColors = (roomKey: string) => {
    roomColors.delete(roomKey);
};
