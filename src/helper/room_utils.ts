import { getPlayer, getPlayerCountInRoom } from "@/db/queries/player";
import { getAllWaitingRooms, getRoomByKey } from "@/db/queries/room";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import type { AppServer, AppSocket } from "@/types/type";

export const MAX_PLAYER_COUNT = 4;

/**
 * Resolves a roomKey to its DB row id, using the socket cache when available.
 * Returns null if the room doesn't exist.
 */
export async function resolveRoomId(
	roomKey: string,
	socket?: AppSocket,
): Promise<number | null> {
	if (socket?.data.roomKey === roomKey && socket.data.dbRoomId > 0) {
		return socket.data.dbRoomId;
	}

	const room = await getRoomByKey(roomKey);
	if (!room) {
		return null;
	}

	if (socket?.data.roomKey === roomKey) {
		socket.data.dbRoomId = room.id;
	}

	return room.id;
}

/**
 * Returns whether the room has capacity for the user.
 * Reconnecting players (who already exist in the DB) bypass the limit.
 */
export async function checkRoomCapacity(
	roomId: number,
	userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
	const existingPlayer = await getPlayer(roomId, userId);
	if (existingPlayer) {
		return { allowed: true };
	}

	const count = await getPlayerCountInRoom(roomId);
	if (count >= MAX_PLAYER_COUNT) {
		return { allowed: false, reason: "Room Limit Reached" };
	}

	return { allowed: true };
}

export async function broadcastRoomList(io: AppServer): Promise<void> {
	// First, try to trigger the Next.js frontend to revalidate its cache
	try {
		await fetch("http://localhost:3000/api/revalidate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ tag: "rooms" }),
		});
	} catch (error) {
		console.error("Failed to revalidate frontend cache:", error);
	}

	// Then broadcast to socket clients
	io.emit(SOCKET_EVENTS.GET_ALL_ROOMS, await getAllWaitingRooms());
}

export function notifyPlayerLeft(
	io: AppServer,
	roomKey: string,
	userId: string,
): void {
	io.to(roomKey).emit(SOCKET_EVENTS.USER_DISCONNECTED, userId);
	io.to(roomKey).emit(SOCKET_EVENTS.PLAYER_LEFT, userId);
}
