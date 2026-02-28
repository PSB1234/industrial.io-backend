import { clearRoomMessages, getRoomMessages } from "@/db/queries/chat";
import {
	createPlayer,
	deletePlayer,
	getPlayerCountInRoom,
	getPlayersInRoom,
} from "@/db/queries/player";
import { getPlayerPropertiesWithRanks } from "@/db/queries/property";
import {
	createRoom as createDbRoom,
	getAllWaitingRooms,
	getCurrentTurn,
	getRoomByKey,
	getRoomStatus,
	setRoomStatus,
} from "@/db/queries/room";
import { addVote, getVotedPlayers, getVotes } from "@/db/queries/votes";
import { generateRoomId, numberOfPlayersInRoom } from "@/helper";
import { checkRoomCapacity } from "@/helper/room_utils";
import { deleteRoom } from "@/lib/utils/room_cleanup";
import type {
	ChangeStatusResult,
	CreateRoomResult,
	JoinRoomResult,
	LeaveResult,
	Player,
	RoomData,
	VoteResult,
} from "@/types/type";

export function selectRandomRoom(roomList: RoomData[]): string {
	const roomKeys = roomList.map((room) => room.roomKey);
	const randomIndex = Math.floor(Math.random() * roomKeys.length);
	const randomRoom = roomKeys[randomIndex];
	if (!randomRoom) {
		throw new Error("No rooms available to join");
	}
	return randomRoom;
}

export async function createRoom(
	options: { roomName: string; type: "public" | "private"; password?: string },
	userId: string,
	socketId: string,
	username: string,
	color: string,
): Promise<CreateRoomResult> {
	const roomKey = await generateRoomId();
	const roomId = await createDbRoom(
		roomKey,
		options.roomName,
		options.type,
		options.password,
	);
	const player = await createPlayer(
		roomId,
		userId,
		socketId,
		username,
		color,
		true,
	);
	await clearRoomMessages(roomId);

	const players = await getPlayersInRoom(roomId);
	const currentTurn = await getCurrentTurn(roomKey);
	const votedPlayers = await getVotedPlayers(roomId, userId);

	const [playerProperties, playerVotes] = await Promise.all([
		getPlayerPropertiesWithRanks(roomId, userId),
		getVotes(roomId, userId),
	]);

	const playerSnapshot: Player = {
		id: userId,
		username,
		socketid: socketId,
		rank: player.rank,
		position: player.position,
		money: player.money,
		color,
		votes: playerVotes,
		properties: playerProperties,
		leader: player.leader,
	};

	return {
		roomKey,
		roomId,
		player,
		players,
		playerSnapshot,
		currentTurn,
		votedPlayers,
	};
}

export async function joinRoom(
	roomKey: string,
	userId: string,
	socketId: string,
	username: string,
	color: string,
): Promise<JoinRoomResult> {
	const room = await getRoomByKey(roomKey);
	if (!room) {
		throw new Error("Room not found");
	}

	const capacity = await checkRoomCapacity(room.id, userId);
	if (!capacity.allowed) {
		throw new Error(capacity.reason || "Room Limit Reached");
	}

	const currentCount = await numberOfPlayersInRoom(room.id);
	const player = await createPlayer(
		room.id,
		userId,
		socketId,
		username,
		color,
		currentCount === 0,
	);

	const players = await getPlayersInRoom(room.id);
	const chatHistory = await getRoomMessages(room.id);
	const currentTurn = await getCurrentTurn(roomKey);
	const votedPlayers = await getVotedPlayers(room.id, userId);

	const [playerProperties, playerVotes] = await Promise.all([
		getPlayerPropertiesWithRanks(room.id, userId),
		getVotes(room.id, userId),
	]);

	const playerSnapshot: Player = {
		id: userId,
		username,
		socketid: socketId,
		rank: player.rank,
		position: player.position,
		money: player.money,
		color,
		votes: playerVotes,
		properties: playerProperties,
		leader: player.leader,
	};

	return {
		roomKey,
		roomId: room.id,
		player,
		players,
		chatHistory,
		currentTurn,
		votedPlayers,
		playerSnapshot,
	};
}

export async function joinRandomRoom(
	userId: string,
	socketId: string,
	username: string,
	color: string,
): Promise<JoinRoomResult> {
	const roomList = await getAllWaitingRooms();
	if (roomList.length === 0) {
		throw new Error("No public rooms available");
	}

	const randomRoomKey = selectRandomRoom(roomList);
	return joinRoom(randomRoomKey, userId, socketId, username, color);
}

export async function changeRoomStatus(
	roomKey: string,
	newStatus: "waiting" | "playing" | "finished",
): Promise<ChangeStatusResult> {
	const oldStatus = await getRoomStatus(roomKey);
	if (!oldStatus) {
		throw new Error("Room not found");
	}

	await setRoomStatus(roomKey, newStatus);

	let timerAction: "start" | "stop" | "none" = "none";
	if (oldStatus === "waiting" && newStatus === "playing") {
		timerAction = "stop";
	} else if (oldStatus === "playing" && newStatus === "waiting") {
		timerAction = "start";
	}

	return { oldStatus, newStatus, timerAction };
}

export async function addPlayerVote(
	roomId: number,
	playerId: string,
	voterId: string,
): Promise<VoteResult> {
	await addVote(roomId, playerId, voterId);
	const currentVotes = await getVotes(roomId, playerId);
	return { playerId, currentVotes, voterId };
}

export async function leaveRoom(
	roomId: number,
	roomKey: string,
	userId: string,
): Promise<LeaveResult> {
	await deletePlayer(roomId, userId);

	const remaining = await getPlayerCountInRoom(roomId);
	const roomEmpty = remaining === 0;

	if (roomEmpty) {
		console.log(`Room ${roomKey} is empty, deleting room`);
		await deleteRoom(roomKey);
	}

	return { userId, roomEmpty };
}
