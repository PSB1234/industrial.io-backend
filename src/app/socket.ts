import { randomUUID } from "node:crypto";
import type { Server as NodeServer } from "node:http";
import { eq } from "drizzle-orm";
import { Server, type Socket } from "socket.io";
import {
	adjectives,
	animals,
	colors,
	uniqueNamesGenerator,
} from "unique-names-generator";
import { registerChatController } from "@/controller/chat.controller";
import { registerGameController } from "@/controller/game.controller";
import { registerRoomController } from "@/controller/room.controller";
import { db } from "@/db";
import { getPlayersInRoom } from "@/db/queries/player";
import { delCache } from "@/db/redis";
import { players } from "@/db/schema";
import { env } from "@/env";
import {
	computeUserId,
	handleConnection,
	handleDisconnection,
	isUserConnected,
} from "@/helper";
import {
	broadcastRoomList,
	handleTurnAfterLeave,
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

export function initializeSocket(httpServer: NodeServer) {
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

	io.on(
		"connection",
		async (
			socket: Socket<
				ClientToServerEvents,
				ServerToClientEvents,
				InterServerEvents,
				SocketData
			>,
		) => {
			try {
				const authUsername = socket.handshake.auth.username as
					| string
					| undefined;
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

				if (hasConnected) {
					io.emit(SOCKET_EVENTS.USER_CONNECTED, socket.data.name);
				}
				socket.emit(SOCKET_EVENTS.USERNAME_ASSIGNED, socket.data.name);

				registerRoomController(io, socket);
				registerChatController(io, socket);
				registerGameController(io, socket);

				socket.on(
					SOCKET_EVENTS.CHANGE_NAME,
					async (
						newName: string,
						callback?: (success: boolean, username: string) => void,
					) => {
						try {
							if (!newName || newName.trim() === "") {
								if (callback) callback(false, socket.data.name);
								return;
							}

							const trimmedName = newName.trim().slice(0, 20); // enforce max length if needed
							socket.data.name = trimmedName;

							// If the player is in a room, update the database
							if (socket.data.dbPlayerId && socket.data.roomKey) {
								try {
									await db
										.update(players)
										.set({ username: trimmedName })
										.where(eq(players.id, socket.data.dbPlayerId));

									await delCache(`room:players:${socket.data.dbRoomId}`);
									const playersList = await getPlayersInRoom(
										socket.data.dbRoomId,
									);
									const updatedPlayer = playersList.find(
										(p) => p.id === socket.data.userid,
									);
									if (updatedPlayer) {
										io.to(socket.data.roomKey).emit(
											SOCKET_EVENTS.GAME_LOOP,
											socket.data.roomKey,
											updatedPlayer,
										);
									}
								} catch (err) {
									console.error("Failed to update name in db", err);
								}
							}

							if (callback) callback(true, trimmedName);
							socket.emit(SOCKET_EVENTS.USERNAME_ASSIGNED, trimmedName);
						} catch (error) {
							console.error("Error changing name:", error);
							if (callback) callback(false, socket.data.name);
						}
					},
				);

				socket.on("disconnect", async () => {
					try {
						const isFullyDisconnected = handleDisconnection(userId);
						if (!isFullyDisconnected) return;

						const roomKey = socket.data.roomKey;
						if (!roomKey) return;

						const roomId = await resolveRoomId(roomKey, socket);
						if (!roomId) return;

						schedulePendingDisconnect(userId, async () => {
							if (isUserConnected(userId)) {
								return;
							}

							const result = await roomService.leaveRoom(
								roomId,
								roomKey,
								userId,
							);
							notifyPlayerLeft(io, roomKey, result.userId);
							await handleTurnAfterLeave(
								io,
								roomKey,
								roomId,
								result.leavingPlayerRank,
							);
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

				await broadcastRoomList(io);

				socket.on("error", (error: Error) => {
					console.error("Socket error:", error);
				});
			} catch (error: unknown) {
				console.error("Connection error:", error);
				socket.disconnect();
			}
		},
	);
}
