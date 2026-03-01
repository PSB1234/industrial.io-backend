import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db/queries/chat", () => ({
	addChatMessage: vi.fn(),
}));

vi.mock("@/db/queries/player", () => ({
	getPlayer: vi.fn(),
}));

vi.mock("@/helper/room_utils", () => ({
	resolveRoomId: vi.fn(),
}));

import { addChatMessage } from "@/db/queries/chat";
import { getPlayer } from "@/db/queries/player";
import { resolveRoomId } from "@/helper/room_utils";
import { sendMessage } from "../chat.service";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("sendMessage", () => {
	it("returns message and playerName on success", async () => {
		(resolveRoomId as Mock).mockResolvedValue(42);
		(getPlayer as Mock).mockResolvedValue({
			id: "user1",
			username: "Alice",
			socketId: "s1",
			rank: 1,
			position: 0,
			money: 1500,
			color: "#ff0000",
			leader: true,
		});
		(addChatMessage as Mock).mockResolvedValue(undefined);

		const result = await sendMessage({
			roomKey: "123456",
			userId: "user1",
			message: "Hello!",
		});

		expect(result).toEqual({
			roomKey: "123456",
			message: "Hello!",
			playerName: "Alice",
		});
		expect(addChatMessage).toHaveBeenCalledWith(42, "user1", "Hello!");
	});

	it("throws if room not found", async () => {
		(resolveRoomId as Mock).mockResolvedValue(null);

		await expect(
			sendMessage({
				roomKey: "999999",
				userId: "user1",
				message: "Hello!",
			}),
		).rejects.toThrow("Room not found");
	});

	it("throws if player not found", async () => {
		(resolveRoomId as Mock).mockResolvedValue(42);
		(getPlayer as Mock).mockResolvedValue(null);

		await expect(
			sendMessage({
				roomKey: "123456",
				userId: "unknown",
				message: "Hello!",
			}),
		).rejects.toThrow("Player not found");
	});
});
