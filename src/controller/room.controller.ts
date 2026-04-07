import { computeUserId, numberOfPlayersInRoom } from "@/helper";
import {
	resetInactivityTimer,
	stopInactivityTracking,
} from "@/helper/inactivity_helpers";
import {
	broadcastRoomList,
	notifyPlayerLeft,
	resolveRoomId,
} from "@/helper/room_utils";
import { hydrateSocketData, resetSocketRoomData } from "@/helper/socket_data";
import { startTimerForRoom } from "@/helper/time_helpers";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import { getRemainingTime, stopRoomTimer } from "@/lib/storage/timer_storage";
import * as roomService from "@/service/room.service";
import type { AppServer, AppSocket } from "@/types/type";
import { createRoomSchema } from "@/types/zod";

export function registerRoomController(io: AppServer, socket: AppSocket) {
	// ── Create Room ──────────────────────────────────────────────

	socket.on(
		SOCKET_EVENTS.CREATE_ROOM,
		async (options: any, color: string, callback: Function) => {
			try {
				const { success, data, error } = createRoomSchema.safeParse(options);
				if (!success) {
					console.error("Invalid room options:", error);
					socket.emit(SOCKET_EVENTS.ERROR, "Invalid room options");
					return;
				}

				const result = await roomService.createRoom(
					data,
					socket.data.userid,
					socket.data.socketid,
					socket.data.name,
					color,
				);

				hydrateSocketData(
					socket,
					result.roomKey,
					result.roomId,
					result.player,
					color,
				);
				socket.join(result.roomKey);

				callback(result.roomKey, result.players);

				startTimerForRoom(io, result.roomKey);

				// Broadcast join state
				io.to(result.roomKey).emit(
					SOCKET_EVENTS.GAME_LOOP,
					result.roomKey,
					result.playerSnapshot,
				);
				io.to(result.roomKey).emit(
					SOCKET_EVENTS.RECEIVE_TURN,
					result.currentTurn,
				);
				socket.emit(SOCKET_EVENTS.YOUR_VOTES, result.votedPlayers);
				await broadcastRoomList(io);

				console.log(
					`User ${socket.id} created & joined room: ${result.roomKey}`,
				);
			} catch (error) {
				console.error("Error creating room:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Joining Room Failed");
			}
		},
	);

	// ── Join Random Room ─────────────────────────────────────────

	socket.on(
		SOCKET_EVENTS.JOIN_RANDOM_ROOM,
		async (color: string, callback: Function) => {
			try {
				const result = await roomService.joinRandomRoom(
					socket.data.userid,
					socket.data.socketid,
					socket.data.name,
					color,
				);

				hydrateSocketData(
					socket,
					result.roomKey,
					result.roomId,
					result.player,
					color,
				);
				socket.join(result.roomKey);

				io.to(result.roomKey).emit(
					SOCKET_EVENTS.USER_CONNECTED,
					socket.data.name,
				);
				socket.emit(SOCKET_EVENTS.CHAT_HISTORY, result.chatHistory);

				// Broadcast join state
				io.to(result.roomKey).emit(
					SOCKET_EVENTS.GAME_LOOP,
					result.roomKey,
					result.playerSnapshot,
				);
				io.to(result.roomKey).emit(
					SOCKET_EVENTS.RECEIVE_TURN,
					result.currentTurn,
				);
				socket.emit(SOCKET_EVENTS.YOUR_VOTES, result.votedPlayers);
				await broadcastRoomList(io);

				if (typeof callback === "function") {
					callback(result.roomKey, result.players);
				}

				console.log(`User joined room: ${result.roomKey}`);
			} catch (error) {
				console.error("Error joining room:", error);
				const msg =
					error instanceof Error ? error.message : "Failed to join room";
				socket.emit(SOCKET_EVENTS.ERROR, msg);
			}
		},
	);

	// ── Join Room ────────────────────────────────────────────────

	socket.on(
		SOCKET_EVENTS.JOIN_ROOM,
		async (
			username: string,
			roomKey: string,
			color: string,
			password: string | undefined,
			callback: Function,
		) => {
			try {
				if (username) {
					socket.data.name = username;
				}

				const result = await roomService.joinRoom(
					roomKey,
					socket.data.userid,
					socket.data.socketid,
					socket.data.name,
					color,
					password,
				);

				hydrateSocketData(
					socket,
					result.roomKey,
					result.roomId,
					result.player,
					color,
				);
				socket.join(result.roomKey);

				callback(socket.data.name, result.players);
				console.log(`User ${username} joined room: ${result.roomKey}`);

				socket.emit(SOCKET_EVENTS.CHAT_HISTORY, result.chatHistory);

				// Broadcast join state
				io.to(result.roomKey).emit(
					SOCKET_EVENTS.GAME_LOOP,
					result.roomKey,
					result.playerSnapshot,
				);
				io.to(result.roomKey).emit(
					SOCKET_EVENTS.RECEIVE_TURN,
					result.currentTurn,
				);
				socket.emit(SOCKET_EVENTS.YOUR_VOTES, result.votedPlayers);
				await broadcastRoomList(io);

				const remaining = getRemainingTime(result.roomKey);
				if (remaining > 0) {
					socket.emit(SOCKET_EVENTS.TIMER_TICK, remaining);
				}
			} catch (error) {
				console.error("Error joining room:", error);
				const msg =
					error instanceof Error ? error.message : "Failed to join room";
				socket.emit(SOCKET_EVENTS.ERROR, msg);
			}
		},
	);

	// ── Change Room Status ───────────────────────────────────────

	socket.on(
		SOCKET_EVENTS.CHANGE_ROOM_STATUS,
		async (roomKey: string, status: any) => {
			try {
				const result = await roomService.changeRoomStatus(roomKey, status);

				if (result.timerAction === "stop") {
					stopRoomTimer(roomKey);
				} else if (result.timerAction === "start") {
					startTimerForRoom(io, roomKey);
				}

				// Start inactivity tracking when game begins, stop otherwise
				if (result.newStatus === "playing") {
					resetInactivityTimer(io, roomKey);
				} else {
					stopInactivityTracking(roomKey);
				}

				io.to(roomKey).emit(SOCKET_EVENTS.AFTER_CHANGE_ROOM_STATUS);
				await broadcastRoomList(io);
			} catch (error) {
				console.error("Error changing room status:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to change room status");
			}
		},
	);

	// ── Vote to Kick ─────────────────────────────────────────────

	socket.on(
		SOCKET_EVENTS.SEND_VOTE,
		async (roomKey: string, playerId: string, _votes: number) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const result = await roomService.addPlayerVote(
					roomId,
					playerId,
					socket.data.userid,
				);

				io.to(roomKey).emit(
					SOCKET_EVENTS.RECEIVE_VOTE,
					result.playerId,
					result.currentVotes,
					result.voterId,
				);

				const totalPlayers = await numberOfPlayersInRoom(roomId);
				if (result.currentVotes >= Math.ceil(totalPlayers / 2)) {
					const leaveResult = await roomService.leaveRoom(
						roomId,
						roomKey,
						playerId,
					);

					const sockets = await io.in(roomKey).fetchSockets();
					for (const s of sockets) {
						if (s.data.userid === playerId) {
							s.emit(SOCKET_EVENTS.PLAYER_LEFT, playerId);
							s.leave(roomKey);
							s.data.roomKey = "";
							s.data.dbRoomId = 0;
							s.data.dbPlayerId = 0;
							s.data.rank = 0;
							s.data.position = 0;
							s.data.money = 0;
							s.data.color = "#000000";
							s.data.properties = [];
							s.data.leader = false;
							s.data.behindBars = false;
						}
					}

					notifyPlayerLeft(io, roomKey, leaveResult.userId);

					if (leaveResult.roomEmpty) {
						stopRoomTimer(roomKey);
						stopInactivityTracking(roomKey);
					}

					await broadcastRoomList(io);
				}
			} catch (error) {
				console.error("Error sending vote:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to send vote");
			}
		},
	);

	// ── Leave Game (mid-game surrender) ──────────────────────────

	socket.on(
		SOCKET_EVENTS.LEAVE_GAME,
		async (userId: string, roomKey: string) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const result = await roomService.leaveRoom(roomId, roomKey, userId);

				socket.leave(roomKey);
				if (socket.data.userid === userId) {
					resetSocketRoomData(socket);
				}

				notifyPlayerLeft(io, roomKey, result.userId);

				if (result.roomEmpty) {
					stopRoomTimer(roomKey);
					stopInactivityTracking(roomKey);
				}

				await broadcastRoomList(io);
			} catch (error) {
				console.error("Error leaving room:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to leave room");
			}
		},
	);

	// ── Leave Room (waiting room exit) ───────────────────────────

	socket.on(SOCKET_EVENTS.LEAVE_ROOM, async (roomKey: string) => {
		try {
			const userId = computeUserId(socket);
			const roomId = await resolveRoomId(roomKey, socket);
			if (!roomId) return;

			const result = await roomService.leaveRoom(roomId, roomKey, userId);

			socket.leave(roomKey);
			resetSocketRoomData(socket);

			notifyPlayerLeft(io, roomKey, result.userId);

			if (result.roomEmpty) {
				stopRoomTimer(roomKey);
				stopInactivityTracking(roomKey);
			}

			await broadcastRoomList(io);
		} catch (error) {
			console.error("Error leaving room:", error);
			socket.emit(SOCKET_EVENTS.ERROR, "Failed to leave room");
		}
	});
}
