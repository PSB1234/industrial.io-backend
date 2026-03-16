import { clearRoomMessages, getRoomMessages } from "@/db/queries/chat";
import { hashPassword, verifyPassword } from "@/lib/utils/password";
import { grantRoomAccess, hasRoomAccess } from "@/db/queries/room_access";
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
import { generateRoomId } from "@/helper";
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
	const hashedPassword =
		options.type === "private" && options.password
			? hashPassword(options.password)
			: undefined;
	const roomId = await createDbRoom(
		roomKey,
		options.roomName,
		options.type,
		hashedPassword,
	);
	const player = await createPlayer(
		roomId,
		userId,
		socketId,
		username,
		color,
		true,
	);

	const [players, currentTurn, votedPlayers, playerProperties, playerVotes] =
		await Promise.all([
			getPlayersInRoom(roomId),
			getCurrentTurn(roomKey),
			getVotedPlayers(roomId, userId),
			getPlayerPropertiesWithRanks(roomId, userId),
			getVotes(roomId, userId),
			clearRoomMessages(roomId),
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
	password?: string,
): Promise<JoinRoomResult> {
	const room = await getRoomByKey(roomKey);
	if (!room) {
		throw new Error("Room not found");
	}

	if (room.type === "private") {
		const alreadyVerified = await hasRoomAccess(room.id, userId);
		if (!alreadyVerified) {
			if (!password) throw new Error("Password required");
			if (!room.password || !verifyPassword(password, room.password)) {
				throw new Error("Incorrect password");
			}
			await grantRoomAccess(room.id, userId);
		}
	}

	const capacity = await checkRoomCapacity(room.id, userId);
	if (!capacity.allowed) {
		throw new Error(capacity.reason || "Room Limit Reached");
	}

	const player = await createPlayer(
		room.id,
		userId,
		socketId,
		username,
		color,
		capacity.count === 0,
	);

	const [
		players,
		chatHistory,
		currentTurn,
		votedPlayers,
		playerProperties,
		playerVotes,
	] = await Promise.all([
		getPlayersInRoom(room.id),
		getRoomMessages(room.id),
		getCurrentTurn(roomKey),
		getVotedPlayers(room.id, userId),
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
	const publicRooms = roomList.filter((r) => !r.isPrivate);
	if (publicRooms.length === 0) {
		throw new Error("No public rooms available");
	}

	const randomRoomKey = selectRandomRoom(publicRooms);
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
