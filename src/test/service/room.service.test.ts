import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db/queries/chat", () => ({
	clearRoomMessages: vi.fn(),
	getRoomMessages: vi.fn(),
}));

vi.mock("@/db/queries/player", () => ({
	createPlayer: vi.fn(),
	deletePlayer: vi.fn(),
	getPlayerCountInRoom: vi.fn(),
	getPlayersInRoom: vi.fn(),
	resetPlayersForNewGame: vi.fn(),
}));

vi.mock("@/db/queries/property", () => ({
	getPlayerPropertiesWithRanks: vi.fn(),
}));

vi.mock("@/db/queries/room", () => ({
	createRoom: vi.fn(),
	getAllWaitingRooms: vi.fn(),
	getCurrentTurn: vi.fn(),
	getRoomByKey: vi.fn(),
	getRoomStatus: vi.fn(),
	setRoomStatus: vi.fn(),
}));

vi.mock("@/db/queries/room_access", () => ({
	grantRoomAccess: vi.fn(),
	hasRoomAccess: vi.fn(),
}));

vi.mock("@/db/queries/votes", () => ({
	addVote: vi.fn(),
	getVotedPlayers: vi.fn(),
	getVotes: vi.fn(),
}));

vi.mock("@/helper", () => ({
	generateRoomId: vi.fn(),
}));

vi.mock("@/helper/room_utils", () => ({
	checkRoomCapacity: vi.fn(),
}));

vi.mock("@/lib/utils/room_cleanup", () => ({
	deleteRoom: vi.fn(),
}));

vi.mock("@/lib/utils/password", () => ({
	hashPassword: vi.fn(),
	verifyPassword: vi.fn(),
}));

import { clearRoomMessages, getRoomMessages } from "@/db/queries/chat";
import {
	createPlayer,
	deletePlayer,
	getPlayerCountInRoom,
	getPlayersInRoom,
	resetPlayersForNewGame,
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
import { grantRoomAccess, hasRoomAccess } from "@/db/queries/room_access";
import { addVote, getVotedPlayers, getVotes } from "@/db/queries/votes";
import { generateRoomId } from "@/helper";
import { checkRoomCapacity } from "@/helper/room_utils";
import { hashPassword, verifyPassword } from "@/lib/utils/password";
import { deleteRoom } from "@/lib/utils/room_cleanup";
import {
	addPlayerVote,
	changeRoomStatus,
	createRoom,
	joinRandomRoom,
	joinRoom,
	leaveRoom,
	selectRandomRoom,
} from "@/service/room.service";

beforeEach(() => {
	vi.clearAllMocks();
});

// ── selectRandomRoom ────────────────────────────────────────────

describe("selectRandomRoom", () => {
	it("returns a key from the list", () => {
		const rooms = [
			{ roomKey: "111111", name: "Room A" },
			{ roomKey: "222222", name: "Room B" },
		];
		const result = selectRandomRoom(rooms);
		expect(["111111", "222222"]).toContain(result);
	});

	it("throws on empty list", () => {
		expect(() => selectRandomRoom([])).toThrow("No rooms available to join");
	});
});

// ── createRoom ──────────────────────────────────────────────────

describe("createRoom", () => {
	it("returns correct CreateRoomResult shape", async () => {
		(hashPassword as Mock).mockReturnValue("hashed-value");
		(generateRoomId as Mock).mockResolvedValue("123456");
		(createDbRoom as Mock).mockResolvedValue(42);
		(createPlayer as Mock).mockResolvedValue({
			id: 1,
			rank: 1,
			position: 0,
			money: 1500,
			leader: true,
		});
		(getPlayersInRoom as Mock).mockResolvedValue([]);
		(getCurrentTurn as Mock).mockResolvedValue(1);
		(getVotedPlayers as Mock).mockResolvedValue([]);
		(getPlayerPropertiesWithRanks as Mock).mockResolvedValue([]);
		(getVotes as Mock).mockResolvedValue(0);
		(clearRoomMessages as Mock).mockResolvedValue(undefined);

		const result = await createRoom(
			{ roomName: "Test", type: "public" },
			"user1",
			"socket1",
			"Alice",
			"#ff0000",
		);

		expect(result.roomKey).toBe("123456");
		expect(result.roomId).toBe(42);
		expect(result.player.leader).toBe(true);
		expect(result.playerSnapshot.id).toBe("user1");
		expect(result.playerSnapshot.username).toBe("Alice");
		expect(createDbRoom).toHaveBeenCalledWith(
			"123456",
			"Test",
			"public",
			undefined,
		);
		expect(createPlayer).toHaveBeenCalledWith(
			42,
			"user1",
			"socket1",
			"Alice",
			"#ff0000",
			true,
		);
	});

	it("grants creator private-room access when creating a private room", async () => {
		(hashPassword as Mock).mockReturnValue("hashed-secret");
		(generateRoomId as Mock).mockResolvedValue("654321");
		(createDbRoom as Mock).mockResolvedValue(99);
		(createPlayer as Mock).mockResolvedValue({
			id: 1,
			rank: 1,
			position: 0,
			money: 1500,
			leader: true,
		});
		(getPlayersInRoom as Mock).mockResolvedValue([]);
		(getCurrentTurn as Mock).mockResolvedValue(1);
		(getVotedPlayers as Mock).mockResolvedValue([]);
		(getPlayerPropertiesWithRanks as Mock).mockResolvedValue([]);
		(getVotes as Mock).mockResolvedValue(0);
		(clearRoomMessages as Mock).mockResolvedValue(undefined);

		await createRoom(
			{ roomName: "Locked", type: "private", password: "secret" },
			"creator-id",
			"socket1",
			"Alice",
			"#ff0000",
		);

		expect(createDbRoom).toHaveBeenCalledWith(
			"654321",
			"Locked",
			"private",
			"hashed-secret",
		);
		expect(grantRoomAccess).toHaveBeenCalledWith(99, "creator-id");
	});
});

// ── joinRoom ────────────────────────────────────────────────────

describe("joinRoom", () => {
	const setupJoinMocks = () => {
		(createPlayer as Mock).mockResolvedValue({
			id: 2,
			rank: 2,
			position: 0,
			money: 1500,
			leader: false,
		});
		(getPlayersInRoom as Mock).mockResolvedValue([]);
		(getRoomMessages as Mock).mockResolvedValue([]);
		(getCurrentTurn as Mock).mockResolvedValue(1);
		(getVotedPlayers as Mock).mockResolvedValue([]);
		(getPlayerPropertiesWithRanks as Mock).mockResolvedValue([]);
		(getVotes as Mock).mockResolvedValue(0);
	};

	it("joins room successfully", async () => {
		(hasRoomAccess as Mock).mockResolvedValue(false);
		(getRoomByKey as Mock).mockResolvedValue({ id: 42, roomKey: "123456" });
		(checkRoomCapacity as Mock).mockResolvedValue({
			allowed: true,
			count: 1,
		});
		setupJoinMocks();

		const result = await joinRoom(
			"123456",
			"user2",
			"socket2",
			"Bob",
			"#00ff00",
		);

		expect(result.roomKey).toBe("123456");
		expect(result.roomId).toBe(42);
		expect(result.playerSnapshot.username).toBe("Bob");
	});

	it("throws password required when first-time private-room join has no password", async () => {
		(hasRoomAccess as Mock).mockResolvedValue(false);
		(getRoomByKey as Mock).mockResolvedValue({
			id: 42,
			roomKey: "123456",
			type: "private",
			password: "hashed-secret",
		});

		await expect(
			joinRoom("123456", "user2", "socket2", "Bob", "#00ff00"),
		).rejects.toThrow("Password required");
	});

	it("throws incorrect password for first-time private-room join with wrong password", async () => {
		(hasRoomAccess as Mock).mockResolvedValue(false);
		(verifyPassword as Mock).mockReturnValue(false);
		(getRoomByKey as Mock).mockResolvedValue({
			id: 42,
			roomKey: "123456",
			type: "private",
			password: "hashed-secret",
		});

		await expect(
			joinRoom(
				"123456",
				"user2",
				"socket2",
				"Bob",
				"#00ff00",
				"wrong-password",
			),
		).rejects.toThrow("Incorrect password");
	});

	it("grants access on first correct private-room password and allows join", async () => {
		(hasRoomAccess as Mock).mockResolvedValue(false);
		(verifyPassword as Mock).mockReturnValue(true);
		(getRoomByKey as Mock).mockResolvedValue({
			id: 42,
			roomKey: "123456",
			type: "private",
			password: "hashed-secret",
		});
		(checkRoomCapacity as Mock).mockResolvedValue({
			allowed: true,
			count: 1,
		});
		setupJoinMocks();

		await joinRoom(
			"123456",
			"user2",
			"socket2",
			"Bob",
			"#00ff00",
			"correct-password",
		);

		expect(verifyPassword).toHaveBeenCalledWith(
			"correct-password",
			"hashed-secret",
		);
		expect(grantRoomAccess).toHaveBeenCalledWith(42, "user2");
	});

	it("skips password check when user already has private-room access", async () => {
		(hasRoomAccess as Mock).mockResolvedValue(true);
		(getRoomByKey as Mock).mockResolvedValue({
			id: 42,
			roomKey: "123456",
			type: "private",
			password: "hashed-secret",
		});
		(checkRoomCapacity as Mock).mockResolvedValue({
			allowed: true,
			count: 1,
		});
		setupJoinMocks();

		await joinRoom("123456", "user2", "socket2", "Bob", "#00ff00");

		expect(verifyPassword).not.toHaveBeenCalled();
		expect(grantRoomAccess).not.toHaveBeenCalled();
	});

	it("throws 'Room not found' if room missing", async () => {
		(getRoomByKey as Mock).mockResolvedValue(null);

		await expect(
			joinRoom("999999", "user2", "socket2", "Bob", "#00ff00"),
		).rejects.toThrow("Room not found");
	});

	it("throws if capacity exceeded", async () => {
		(getRoomByKey as Mock).mockResolvedValue({ id: 42, roomKey: "123456" });
		(checkRoomCapacity as Mock).mockResolvedValue({
			allowed: false,
			reason: "Room Limit Reached",
			count: 4,
		});

		await expect(
			joinRoom("123456", "user2", "socket2", "Bob", "#00ff00"),
		).rejects.toThrow("Room Limit Reached");
	});
});

// ── joinRandomRoom ──────────────────────────────────────────────

describe("joinRandomRoom", () => {
	it("throws if no public rooms available", async () => {
		(getAllWaitingRooms as Mock).mockResolvedValue([]);

		await expect(
			joinRandomRoom("user1", "socket1", "Alice", "#ff0000"),
		).rejects.toThrow("No public rooms available");
	});
});

// ── changeRoomStatus ────────────────────────────────────────────

describe("changeRoomStatus", () => {
	it("waiting→playing returns timerAction 'stop'", async () => {
		(getRoomStatus as Mock).mockResolvedValue("waiting");
		(getRoomByKey as Mock).mockResolvedValue({ id: 42, roomKey: "room1" });
		(resetPlayersForNewGame as Mock).mockResolvedValue(undefined);
		(setRoomStatus as Mock).mockResolvedValue(undefined);

		const result = await changeRoomStatus("room1", "playing");
		expect(result.timerAction).toBe("stop");
		expect(result.oldStatus).toBe("waiting");
		expect(result.newStatus).toBe("playing");
		expect(resetPlayersForNewGame).toHaveBeenCalledWith(42, 2500);
	});

	it("playing→waiting returns timerAction 'start'", async () => {
		(getRoomStatus as Mock).mockResolvedValue("playing");
		(setRoomStatus as Mock).mockResolvedValue(undefined);

		const result = await changeRoomStatus("room1", "waiting");
		expect(result.timerAction).toBe("start");
	});

	it("same status returns timerAction 'none'", async () => {
		(getRoomStatus as Mock).mockResolvedValue("waiting");
		(setRoomStatus as Mock).mockResolvedValue(undefined);

		const result = await changeRoomStatus("room1", "waiting");
		expect(result.timerAction).toBe("none");
	});

	it("throws if room not found", async () => {
		(getRoomStatus as Mock).mockResolvedValue(null);

		await expect(changeRoomStatus("room1", "playing")).rejects.toThrow(
			"Room not found",
		);
	});
});

// ── addPlayerVote ───────────────────────────────────────────────

describe("addPlayerVote", () => {
	it("records vote and returns count", async () => {
		(addVote as Mock).mockResolvedValue(undefined);
		(getVotes as Mock).mockResolvedValue(3);

		const result = await addPlayerVote(1, "player1", "voter1");
		expect(result).toEqual({
			playerId: "player1",
			currentVotes: 3,
			voterId: "voter1",
		});
		expect(addVote).toHaveBeenCalledWith(1, "player1", "voter1");
	});
});

// ── leaveRoom ───────────────────────────────────────────────────

describe("leaveRoom", () => {
	it("deletes player and room if empty", async () => {
		(deletePlayer as Mock).mockResolvedValue(undefined);
		(getPlayerCountInRoom as Mock).mockResolvedValue(0);
		(deleteRoom as Mock).mockResolvedValue(undefined);

		const result = await leaveRoom(1, "room1", "user1");
		expect(result).toEqual({ userId: "user1", roomEmpty: true });
		expect(deleteRoom).toHaveBeenCalledWith("room1");
	});

	it("deletes player but keeps room if others remain", async () => {
		(deletePlayer as Mock).mockResolvedValue(undefined);
		(getPlayerCountInRoom as Mock).mockResolvedValue(2);

		const result = await leaveRoom(1, "room1", "user1");
		expect(result).toEqual({ userId: "user1", roomEmpty: false });
		expect(deleteRoom).not.toHaveBeenCalled();
	});
});
