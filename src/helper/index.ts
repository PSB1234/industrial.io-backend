import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io";
import { getPlayerCountInRoom } from "@/db/queries/player";
import { getRoomByKey } from "@/db/queries/room";

// ── Connection tracking ──────────────────────────────────────────

const users = new Map<string, number>();

export function isUserConnected(userId: string) {
	return users.has(userId);
}

export function usersCount() {
	return users.size;
}

export function handleConnection(userId: string) {
	const count = users.get(userId) || 0;
	users.set(userId, count + 1);
	return count === 0;
}

export function handleDisconnection(userId: string) {
	const count = (users.get(userId) ?? 1) - 1;
	if (count === 0) {
		users.delete(userId);
	} else {
		users.set(userId, count);
	}
	return count === 0;
}

// ── Socket helpers ───────────────────────────────────────────────

export function computeUserId(socket: Socket) {
	return socket.data.userid || randomUUID();
}

// ── Room helpers ─────────────────────────────────────────────────

/** Accepts roomId directly to avoid a redundant getRoomByKey lookup. */
export async function numberOfPlayersInRoom(roomId: number): Promise<number> {
	return getPlayerCountInRoom(roomId);
}

/** Generates a 6-digit room key that doesn't collide with existing rooms. */
export async function generateRoomId(): Promise<string> {
	while (true) {
		const roomKey = Math.floor(100000 + Math.random() * 900000).toString();
		const room = await getRoomByKey(roomKey);
		if (!room) {
			return roomKey;
		}
	}
}
