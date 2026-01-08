import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
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
	getTotalRooms,
	handleConnection,
	handleDisconnection,
} from "@/helper";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import type {
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
} from "@/types/type";
export function initializeSocket(httpServer: import("node:http").Server) {
	const io = new Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>(httpServer, {
		cors: {
			origin: "http://localhost:3000",
			credentials: true,
		},
	});

	io.on("connection", (socket) => {
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
			socket.data.rank = 0;
			// Money will be assigned when joining a room
			const userId: string = computeUserId(socket);
			const hasConnected = handleConnection(userId);

			if (hasConnected) {
				io.emit(SOCKET_EVENTS.USER_CONNECTED, socket.data.name);
			}
			socket.emit(SOCKET_EVENTS.USERNAME_ASSIGNED, socket.data.name);
			socket.emit(SOCKET_EVENTS.GET_ALL_ROOMS, getTotalRooms(io));

			registerRoomController(io, socket);
			registerChatController(io, socket);
			registerGameController(io, socket);
			// Handle disconnection
			socket.on("disconnect", () => {
				try {
					const hasDisconnected = handleDisconnection(userId);
					const roomKey = socket.data.roomKey;
					if (roomKey) {
						socket.broadcast
							.to(roomKey)
							.emit(SOCKET_EVENTS.PLAYER_LEFT, socket.data.userid);
						io.emit(SOCKET_EVENTS.GET_ALL_ROOMS, getTotalRooms(io));
					}
					if (hasDisconnected) {
						socket.emit(SOCKET_EVENTS.USER_DISCONNECTED, userId);
					}
				} catch (error) {
					console.error("Error handling disconnect:", error);
				}
			});
			// Handle errors
			socket.on("error", (error) => {
				console.error("Socket error:", error);
			});
		} catch (error) {
			console.error("Connection error:", error);
			socket.disconnect();
		}
	});
	console.log("Socket.IO initialized");
}
