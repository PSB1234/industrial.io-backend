// ── Timer Helpers (room-controller-internal) ─────────────────────

import { getRoomStatus } from "@/db/queries/room";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import {
	getRemainingTime,
	setRoomTickInterval,
	setRoomTimeout,
	startRoomTimer,
	stopRoomTimer,
} from "@/lib/storage/timer_storage";
import { deleteRoom } from "@/lib/utils/room_cleanup";
import type { AppServer } from "@/types/type";
import { broadcastRoomList } from "./room_utils";

const expiringRooms = new Set<string>();

export function startTimerForRoom(io: AppServer, roomKey: string): void {
	stopRoomTimer(roomKey);
	startRoomTimer(roomKey);

	const tickInterval = setInterval(() => {
		void (async () => {
			const remaining = getRemainingTime(roomKey);
			const currentStatus = await getRoomStatus(roomKey);

			if (!currentStatus) {
				clearInterval(tickInterval);
				return;
			}

			io.to(roomKey).emit(SOCKET_EVENTS.TIMER_TICK, remaining);

			if (remaining <= 0) {
				clearInterval(tickInterval);
				await handleTimerExpired(io, roomKey);
			}
		})().catch((error) => {
			console.error(`Timer tick failed for room ${roomKey}:`, error);
		});
	}, 1000);

	setRoomTickInterval(roomKey, tickInterval);

	const timeout = setTimeout(() => {
		void (async () => {
			if ((await getRoomStatus(roomKey)) === "waiting") {
				await handleTimerExpired(io, roomKey);
			}
		})().catch((error) => {
			console.error(`Timer timeout failed for room ${roomKey}:`, error);
		});
	}, 120000);

	setRoomTimeout(roomKey, timeout);
}

export async function handleTimerExpired(
	io: AppServer,
	roomKey: string,
): Promise<void> {
	if (expiringRooms.has(roomKey)) {
		console.log(
			`Timer expiration already in progress for room ${roomKey}, skipping duplicate call`,
		);
		return;
	}

	expiringRooms.add(roomKey);

	const currentStatus = await getRoomStatus(roomKey);
	if (!currentStatus || currentStatus !== "waiting") {
		expiringRooms.delete(roomKey);
		console.log(
			`Timer expiration skipped for room ${roomKey} - room does not exist or is not in waiting state`,
		);
		return;
	}

	console.log(`Timer expired for room ${roomKey}, deleting room`);

	stopRoomTimer(roomKey);
	io.to(roomKey).emit(SOCKET_EVENTS.TIMER_EXPIRED);

	setImmediate(() => {
		void (async () => {
			try {
				const socketsInRoom = io.of("/").adapter.rooms.get(roomKey);
				if (socketsInRoom) {
					for (const socketId of socketsInRoom) {
						const roomSocket = io.sockets.sockets.get(socketId);
						if (roomSocket) {
							roomSocket.leave(roomKey);
						}
					}
				}

				await deleteRoom(roomKey);
				await broadcastRoomList(io);
				io.emit(SOCKET_EVENTS.ROOM_AUTO_DELETED, roomKey);
			} finally {
				expiringRooms.delete(roomKey);
			}
		})().catch((error) => {
			console.error(`Failed to auto-delete room ${roomKey}:`, error);
		});
	});
}
