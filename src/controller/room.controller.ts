// socket/controllers/room.controller.ts
import type { Server, Socket } from "socket.io";
import { addVote, getVotes, getVotedPlayers } from "@/lib/kick_storage";
import {
	computeUserId,
	generateRoomId,
	getTotalRooms,
	max_Player_Count,
	numberOfPlayersInRoom,
	usersInRoomWithNames,
} from "@/helper";
import { clearRoomMessages, getRoomMessages } from "@/lib/chat_storage";
import { assignColor, removeColor } from "@/lib/color_storage";
import { assignMoney, removeMoney } from "@/lib/money_storage";
import { assignPosition, removePosition } from "@/lib/position_storage";
import {
	getPlayerProperties,
	removeAllPlayerProperties,
} from "@/lib/properties_storage";
import { assignRank, removeRank } from "@/lib/rank_storage";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import { setRoomStatus } from "@/lib/status_storage";
import { getTurn } from "@/lib/turn_storage";
import { joinRandomRoom } from "@/service/room.service";
import type {
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
} from "@/types/type";

export function registerRoomController(
	io: Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>,
	socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
	socket.on(SOCKET_EVENTS.CREATE_ROOM, (isPrivate, color, callback) => {
		try {
			const roomKey = generateRoomId(io);
			const players = usersInRoomWithNames(io, roomKey);
			const rooms = getTotalRooms(io);
			socket.data.roomKey = roomKey;
			socket.data.position = assignPosition(roomKey, socket.data.userid);
			socket.data.rank = assignRank(roomKey, socket.data.userid);

			assignColor(roomKey, socket.data.userid, color);
			socket.data.money = assignMoney(roomKey, socket.data.userid);
			socket.data.color = color;
			socket.data.properties = [];
			setRoomStatus(roomKey, "waiting");
			socket.join(roomKey);
			callback(roomKey, players);
			// Initialize empty chat history
			clearRoomMessages(roomKey);
			const properties = getPlayerProperties(roomKey, socket.data.userid);
			io.to(roomKey).emit(SOCKET_EVENTS.GAME_LOOP, roomKey, {
				id: socket.data.userid,
				username: socket.data.name,
				socketid: socket.data.socketid,
				rank: socket.data.rank,
				position: socket.data.position,
				money: socket.data.money,
				color: socket.data.color,
				votes: getVotes(roomKey, socket.data.userid),
				properties: Array.from(properties),
			});
			// Broadcast current turn
			io.to(roomKey).emit(SOCKET_EVENTS.RECEIVE_TURN, getTurn(roomKey));
			const votedPlayers = getVotedPlayers(roomKey, socket.data.userid);
			socket.emit(SOCKET_EVENTS.YOUR_VOTES, votedPlayers);
			io.emit(SOCKET_EVENTS.GET_ALL_ROOMS, getTotalRooms(io));
			console.log(`User ${socket.id} created & joined room: ${roomKey}`);
		} catch (error) {
			socket.emit(SOCKET_EVENTS.ERROR, "Joining Room Failed");
		}
	});

	socket.on(SOCKET_EVENTS.JOIN_RANDOM_ROOM, (color: string) => {
		try {
			const roomList = getTotalRooms(io);
			if (roomList.length === 0) {
				socket.emit(SOCKET_EVENTS.ERROR, "No public rooms available");
				return;
			}
			const { randomRoomKey } = joinRandomRoom(roomList);
			const noOfPlayersInRoom = numberOfPlayersInRoom(io, randomRoomKey);
			if (noOfPlayersInRoom < max_Player_Count) {
				socket.data.roomKey = randomRoomKey;
				socket.data.rank = assignRank(randomRoomKey, socket.data.userid);
				assignColor(randomRoomKey, socket.data.userid, color);
				socket.data.money = assignMoney(randomRoomKey, socket.data.userid);
				socket.data.color = color;
				socket.data.properties = [];
				socket.join(randomRoomKey);
				//TODO: Initialize the player data
				socket.data.position = assignPosition(
					randomRoomKey,
					socket.data.userid,
				);
				console.log(`User joined room: ${randomRoomKey}`);
				io.to(randomRoomKey).emit(
					SOCKET_EVENTS.USER_CONNECTED,
					socket.data.name,
				);
				// Send chat history to the joining user
				socket.emit(SOCKET_EVENTS.CHAT_HISTORY, getRoomMessages(randomRoomKey));
				const properties = getPlayerProperties(
					randomRoomKey,
					socket.data.userid,
				);
				io.to(randomRoomKey).emit(SOCKET_EVENTS.GAME_LOOP, randomRoomKey, {
					id: socket.data.userid,
					username: socket.data.name,
					socketid: socket.data.socketid,
					rank: socket.data.rank,
					position: socket.data.position,
					money: socket.data.money,
					color: socket.data.color,
					votes: getVotes(randomRoomKey, socket.data.userid),
					properties: Array.from(properties),
				});
				io.to(randomRoomKey).emit(
					SOCKET_EVENTS.RECEIVE_TURN,
					getTurn(randomRoomKey),
				);
				const votedPlayers = getVotedPlayers(
					randomRoomKey,
					socket.data.userid,
				);
				socket.emit(SOCKET_EVENTS.YOUR_VOTES, votedPlayers);
				io.emit(SOCKET_EVENTS.GET_ALL_ROOMS, getTotalRooms(io));
			} else {
				console.error("Error joining room: Room Limit Reached");
				socket.emit(SOCKET_EVENTS.ERROR, "Room Limit Reached");
			}
		} catch (error) {
			console.error("Error joining room:", error);
			socket.emit(SOCKET_EVENTS.ERROR, "Failed to join room");
		}
	});
	socket.on(
		SOCKET_EVENTS.JOIN_ROOM,
		(username: string, roomKey: string, color: string, callback) => {
			try {
				if (numberOfPlayersInRoom(io, roomKey) < max_Player_Count) {
					if (username) {
						socket.data.name = username;
					}
					socket.data.roomKey = roomKey;
					socket.data.rank = assignRank(roomKey, socket.data.userid);
					assignColor(roomKey, socket.data.userid, color);
					socket.data.position = assignPosition(roomKey, socket.data.userid);
					socket.data.money = assignMoney(roomKey, socket.data.userid);
					socket.data.color = color;
					socket.data.properties = [];
					socket.join(roomKey);
					const playerList = usersInRoomWithNames(io, roomKey);
					callback(socket.data.name, playerList);
					console.log(`User ${username} joined room: ${roomKey}`);
					// Send chat history to the joining user
					socket.emit(SOCKET_EVENTS.CHAT_HISTORY, getRoomMessages(roomKey));
					const properties = getPlayerProperties(roomKey, socket.data.userid);
					io.to(roomKey).emit(SOCKET_EVENTS.GAME_LOOP, roomKey, {
						id: socket.data.userid,
						username: socket.data.name,
						socketid: socket.data.socketid,
						rank: socket.data.rank,
						money: socket.data.money,
						position: socket.data.position,
						color: socket.data.color,
						votes: getVotes(roomKey, socket.data.userid),
						properties: Array.from(properties),
					});
					io.to(roomKey).emit(SOCKET_EVENTS.RECEIVE_TURN, getTurn(roomKey));
					const votedPlayers = getVotedPlayers(roomKey, socket.data.userid);
					socket.emit(SOCKET_EVENTS.YOUR_VOTES, votedPlayers);
					io.emit(SOCKET_EVENTS.GET_ALL_ROOMS, getTotalRooms(io));
				} else {
					console.error("Error joining room: Room Limit Reached");
					socket.emit(SOCKET_EVENTS.ERROR, "Room Limit Reached");
				}
			} catch (error) {
				console.error("Error joining room:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to join room");
			}
		},
	);
	socket.on(SOCKET_EVENTS.CHANGE_ROOM_STATUS, (roomKey, status) => {
		try {
			setRoomStatus(roomKey, status);
			io.to(roomKey).emit(SOCKET_EVENTS.AFTER_CHANGE_ROOM_STATUS);
			io.emit(SOCKET_EVENTS.GET_ALL_ROOMS, getTotalRooms(io));
		} catch (error) {
			console.error("Error changing room status:", error);
			socket.emit(SOCKET_EVENTS.ERROR, "Failed to change room status");
		}
	});
	socket.on(
		SOCKET_EVENTS.SEND_VOTE,
		(roomKey: string, playerId: string, votes: number) => {
			addVote(roomKey, playerId, socket.data.userid);
			const currentVotes = getVotes(roomKey, playerId);
			io.to(roomKey).emit(
				SOCKET_EVENTS.RECEIVE_VOTE,
				playerId,
				currentVotes,
				socket.data.userid,
			);
		},
	);
	// * Room Leaving is for waiting room and game leaving is in middle of game
	// Handle game leaving
	socket.on(SOCKET_EVENTS.LEAVE_GAME, (userId: string, roomKey: string) => {
		try {
			removeRank(roomKey, userId);
			removeColor(roomKey, userId);
			removePosition(roomKey, userId);
			removeMoney(roomKey, userId);
			removeAllPlayerProperties(roomKey, userId);
			socket.leave(roomKey);
			console.log(`User ${userId} left room: ${roomKey}`);
			io.to(roomKey).emit(SOCKET_EVENTS.USER_DISCONNECTED, userId);
			io.emit(SOCKET_EVENTS.GET_ALL_ROOMS, getTotalRooms(io));
		} catch (error) {
			console.error("Error leaving room:", error);
			socket.emit(SOCKET_EVENTS.ERROR, "Failed to leave room");
		}
	});
	// Handle room leaving
	socket.on(SOCKET_EVENTS.LEAVE_ROOM, (roomKey: string) => {
		try {
			const userId: string = computeUserId(socket);
			socket.leave(roomKey);
			console.log(`User ${userId} left room: ${roomKey}`);
			io.to(roomKey).emit(SOCKET_EVENTS.USER_DISCONNECTED, userId);
			io.emit(SOCKET_EVENTS.GET_ALL_ROOMS, getTotalRooms(io));
		} catch (error) {
			console.error("Error leaving room:", error);
			socket.emit(SOCKET_EVENTS.ERROR, "Failed to leave room");
		}
	});
}
