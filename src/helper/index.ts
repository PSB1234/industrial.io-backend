import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { getVotes } from "@/lib/storage/kick_storage";
import { assignPosition } from "@/lib/storage/position_storage";
import { getPlayerPropertiesWithRanks } from "@/lib/storage/properties_storage";
import { getRoomName } from "@/lib/storage/room_name_storage";
import { getRoomStatus } from "@/lib/storage/status_storage";
import type {
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
} from "@/types/type";
//Max Player Count
export const max_Player_Count = 4;
export const users = new Map<string, number>();
export const disconnectTimers = new Map<string, NodeJS.Timeout>();
export function numberOfPlayersInRoom(io: Server, room: string) {
	return io.of("/").adapter.rooms.get(room)?.size || 0;
}
export function isUserConnected(userId: string) {
	return users.has(userId);
}

export function usersCount() {
	return users.size;
}

export function usersList() {
	return [...users.keys()];
}
export function usersInRoom(io: Server, roomKey: string) {
	const socketsInRoom = io.of("/").adapter.rooms.get(roomKey);
	if (!socketsInRoom) return [];

	return Array.from(socketsInRoom);
}
export function usersInRoomWithNames(io: Server, roomKey: string) {
	const socketsInRoom = io.of("/").adapter.rooms.get(roomKey);
	if (!socketsInRoom) return [];

	return Array.from(socketsInRoom).map((socketId) => {
		const socket = io.sockets.sockets.get(socketId);
		const userId = socket?.data.userid || randomUUID();
		const properties = getPlayerPropertiesWithRanks(roomKey, userId);
		return {
			id: userId,
			username: socket?.data.name || "Unknown",
			socketid: socket?.data.socketid || "",
			rank: socket?.data.rank,
			position: assignPosition(roomKey, userId),

			money: socket?.data.money || 0,
			color: socket?.data.color || "#000000",
			votes: getVotes(roomKey, userId),
			properties,
			leader: socket?.data.leader || false,
		};
	});
}
export function computeUserId(socket: Socket) {
	return socket.data.userid || randomUUID();
}
export function getTotalSocketMap(
	io: Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>,
) {
	return io.sockets.adapter.rooms;
}
export function getTotalRooms(
	io: Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>,
) {
	const rooms = Array.from(io.of("/").adapter.rooms.keys());
	// Filter out rooms that are socket IDs (private rooms) and only show waiting rooms
	const publicRoomKeys = rooms
		.filter((room) => {
			return !io.sockets.sockets.get(room);
		})
		.filter((room) => {
			const status = getRoomStatus(room);
			return status === "waiting";
		});

	// Map room keys to RoomData objects with name and roomKey
	const publicRooms = publicRoomKeys.map((roomKey) => ({
		roomKey,
		name: getRoomName(roomKey) || roomKey,
	}));

	return publicRooms;
}
export function generateRoomId(
	io: Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>,
) {
	let roomKey: string;
	const rooms = io.sockets.adapter.rooms;
	do {
		roomKey = Math.floor(100000 + Math.random() * 900000).toString();
	} while (rooms.has(roomKey));

	return roomKey;
}
// Track active connections per user
// export const users = new Map<string, number>();

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
