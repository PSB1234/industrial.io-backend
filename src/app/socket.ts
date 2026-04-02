import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { env } from "@/env";
import {
	adjectives,
	animals,
	colors,
	uniqueNamesGenerator,
} from "unique-names-generator";
import { registerChatController } from "@/controller/chat.controller";
import { registerGameController } from "@/controller/game.controller";
import { registerRoomController } from "@/controller/room.controller";
import {
	computeUserId,
	handleConnection,
	handleDisconnection,
	isUserConnected,
} from "@/helper";
import {
	broadcastRoomList,
	notifyPlayerLeft,
	resolveRoomId,
} from "@/helper/room_utils";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import {
	cancelPendingDisconnect,
	schedulePendingDisconnect,
} from "@/lib/storage/disconnect_storage";
import { clearAllInactivityState } from "@/lib/storage/inactivity_storage";
import { stopRoomTimer } from "@/lib/storage/timer_storage";
import * as roomService from "@/service/room.service";
import type {
	AppServer,
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
} from "@/types/type";

export function initializeSocket(httpServer: import("node:http").Server) {
	const io: AppServer = new Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>(httpServer, {
		cors: {
			origin: env.frontend_url,
			credentials: true,
		},
	});

	io.on("connection", async (socket: import("socket.io").Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
		try {
			const authUsername = socket.handshake.auth.username as string | undefined;
			socket.data.name =
				authUsername ||
				uniqueNamesGenerator({
					dictionaries: [adjectives, colors, animals],
					length: 1,
				});
			const authUserId = socket.handshake.auth.userId as string | undefined;
			socket.data.userid = authUserId || randomUUID();
			socket.data.socketid = socket.id;
			socket.data.roomKey = "";
			socket.data.dbRoomId = 0;
			socket.data.dbPlayerId = 0;
			socket.data.rank = 0;
			socket.data.position = 0;
			socket.data.money = 0;
			socket.data.color = "#000000";
			socket.data.properties = [];
			socket.data.leader = false;
			socket.data.skipTurn = false;
			socket.data.behindBars = false;
			const userId: string = computeUserId(socket);
			const hasConnected = handleConnection(userId);

			const wasPending = cancelPendingDisconnect(userId);
			if (wasPending) {
				console.log(`User ${userId} reconnected, cancelled pending disconnect`);
			}

			if (hasConnected) {
				io.emit(SOCKET_EVENTS.USER_CONNECTED, socket.data.name);
			}
			socket.emit(SOCKET_EVENTS.USERNAME_ASSIGNED, socket.data.name);

			// Register all handlers FIRST (synchronous)
			registerRoomController(io, socket);
			registerChatController(io, socket);
			registerGameController(io, socket);

			socket.on("disconnect", async () => {
				try {
					const isFullyDisconnected = handleDisconnection(userId);
					if (!isFullyDisconnected) return;

					const roomKey = socket.data.roomKey;
					if (!roomKey) return;

					const roomId = await resolveRoomId(roomKey, socket);
					if (!roomId) return;

					console.log(
						`User ${userId} disconnected from room ${roomKey}, scheduling cleanup`,
					);

					schedulePendingDisconnect(userId, async () => {
						if (isUserConnected(userId)) {
							console.log(
								`User ${userId} already reconnected, skipping cleanup`,
							);
							return;
						}

						console.log(
							`Grace period expired for ${userId}, cleaning up room ${roomKey}`,
						);
						const result = await roomService.leaveRoom(roomId, roomKey, userId);
						notifyPlayerLeft(io, roomKey, result.userId);
						if (result.roomEmpty) {
							stopRoomTimer(roomKey);
							clearAllInactivityState(roomKey);
						}
						await broadcastRoomList(io);
					});
				} catch (error: unknown) {
					console.error("Error handling disconnect:", error);
				}
			});

			// THEN do async work
			await broadcastRoomList(io);

			socket.on("error", (error: Error) => {
				console.error("Socket error:", error);
			});
		} catch (error: unknown) {
			console.error("Connection error:", error);
			socket.disconnect();
		}
	});
	console.log("Socket.IO initialized");
}
