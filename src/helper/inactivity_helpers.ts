import { getRoomStatus } from "@/db/queries/room";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import {
	clearAllInactivityState,
	clearInactivityTimer,
	clearWarningTickInterval,
	clearWarningTimer,
	INACTIVITY_DELAY_MS,
	setInactivityTimer,
	setWarningTickInterval,
	setWarningTimer,
	WARNING_COUNTDOWN_MS,
} from "@/lib/storage/inactivity_storage";
import { deleteRoom } from "@/lib/utils/room_cleanup";
import type { AppServer } from "@/types/type";
import { broadcastRoomList } from "./room_utils";

export function resetInactivityTimer(io: AppServer, roomKey: string): void {
	// Clear any existing inactivity or warning state
	clearAllInactivityState(roomKey);

	// Dismiss warning on all clients if one was showing
	io.to(roomKey).emit(SOCKET_EVENTS.INACTIVITY_RESET);

	// Start a fresh inactivity timer
	const timer = setTimeout(() => {
		void startWarningPhase(io, roomKey).catch((error) => {
			console.error(
				`Failed to start warning phase for room ${roomKey}:`,
				error,
			);
		});
	}, INACTIVITY_DELAY_MS);

	setInactivityTimer(roomKey, timer);
}

async function startWarningPhase(
	io: AppServer,
	roomKey: string,
): Promise<void> {
	const status = await getRoomStatus(roomKey);
	if (status !== "playing") return;

	clearInactivityTimer(roomKey);

	const countdownSeconds = Math.ceil(WARNING_COUNTDOWN_MS / 1000);
	let remaining = countdownSeconds;

	// Emit initial warning with full countdown
	io.to(roomKey).emit(SOCKET_EVENTS.INACTIVITY_WARNING, remaining);

	// Tick every second
	const tickInterval = setInterval(() => {
		remaining -= 1;
		if (remaining > 0) {
			io.to(roomKey).emit(SOCKET_EVENTS.INACTIVITY_TICK, remaining);
		}
	}, 1000);
	setWarningTickInterval(roomKey, tickInterval);

	// After countdown expires, delete the room
	const warningTimeout = setTimeout(() => {
		void handleInactivityExpired(io, roomKey).catch((error) => {
			console.error(
				`Failed to handle inactivity expiry for room ${roomKey}:`,
				error,
			);
		});
	}, WARNING_COUNTDOWN_MS);
	setWarningTimer(roomKey, warningTimeout);
}

async function handleInactivityExpired(
	io: AppServer,
	roomKey: string,
): Promise<void> {
	const status = await getRoomStatus(roomKey);
	if (!status || status !== "playing") {
		clearAllInactivityState(roomKey);
		return;
	}

	console.log(`Inactivity timer expired for room ${roomKey}, deleting room`);

	clearAllInactivityState(roomKey);

	// Notify all clients the room is being deleted
	io.to(roomKey).emit(SOCKET_EVENTS.TIMER_EXPIRED);

	setImmediate(() => {
		void (async () => {
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
		})().catch((error) => {
			console.error(
				`Failed to auto-delete room ${roomKey} after inactivity:`,
				error,
			);
		});
	});
}

export function handleActivityConfirmation(
	io: AppServer,
	roomKey: string,
): void {
	// Any single player confirming resets for everyone
	clearWarningTimer(roomKey);
	clearWarningTickInterval(roomKey);

	// Restart the idle phase
	resetInactivityTimer(io, roomKey);
}

export function stopInactivityTracking(roomKey: string): void {
	clearAllInactivityState(roomKey);
}
