import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db/queries/player", () => ({
	addPlayerMoney: vi.fn(),
	getPlayerMoney: vi.fn(),
	updatePlayerMoney: vi.fn(),
	updatePlayerPosition: vi.fn(),
}));

vi.mock("@/db/queries/property", () => ({
	assignProperty: vi.fn(),
	getPropertyRank: vi.fn(),
	removeProperty: vi.fn(),
}));

vi.mock("@/db/queries/room", () => ({
	setCurrentTurn: vi.fn(),
}));

vi.mock("@/helper", () => ({
	numberOfPlayersInRoom: vi.fn(),
}));

vi.mock("@/helper/trade", () => ({
	transferProperties: vi.fn(),
	transferMoney: vi.fn(),
}));

import {
	addPlayerMoney,
	getPlayerMoney,
	updatePlayerMoney,
	updatePlayerPosition,
} from "@/db/queries/player";
import {
	assignProperty,
	getPropertyRank,
	removeProperty,
} from "@/db/queries/property";
import { setCurrentTurn } from "@/db/queries/room";
import { numberOfPlayersInRoom } from "@/helper";
import { transferMoney, transferProperties } from "@/helper/trade";
import {
	advanceTurn,
	buyProperty,
	confirmTrade,
	updateMoney,
	updatePosition,
	upgradeProperty,
} from "../game.service";

beforeEach(() => {
	vi.clearAllMocks();
});

// ── advanceTurn ─────────────────────────────────────────────────

describe("advanceTurn", () => {
	it("cycles turn 1→2 with 3 players", async () => {
		(numberOfPlayersInRoom as Mock).mockResolvedValue(3);
		(setCurrentTurn as Mock).mockResolvedValue(undefined);

		const result = await advanceTurn("room1", 1, 1);
		expect(result).toEqual({ nextTurn: 2 });
		expect(setCurrentTurn).toHaveBeenCalledWith("room1", 2);
	});

	it("wraps turn 3→1 with 3 players", async () => {
		(numberOfPlayersInRoom as Mock).mockResolvedValue(3);
		(setCurrentTurn as Mock).mockResolvedValue(undefined);

		const result = await advanceTurn("room1", 1, 3);
		expect(result).toEqual({ nextTurn: 1 });
		expect(setCurrentTurn).toHaveBeenCalledWith("room1", 1);
	});

	it("returns null if 0 players", async () => {
		(numberOfPlayersInRoom as Mock).mockResolvedValue(0);

		const result = await advanceTurn("room1", 1, 1);
		expect(result).toBeNull();
		expect(setCurrentTurn).not.toHaveBeenCalled();
	});
});

// ── updatePosition ──────────────────────────────────────────────

describe("updatePosition", () => {
	it("moves forward by dice value", async () => {
		(updatePlayerPosition as Mock).mockResolvedValue(undefined);

		const result = await updatePosition(1, "user1", 5, 3);
		expect(result).toEqual({ newPosition: 8, userId: "user1" });
		expect(updatePlayerPosition).toHaveBeenCalledWith(1, "user1", 8);
	});

	it("wraps around at 32 (mod 32)", async () => {
		(updatePlayerPosition as Mock).mockResolvedValue(undefined);

		const result = await updatePosition(1, "user1", 30, 5);
		expect(result).toEqual({ newPosition: 3, userId: "user1" });
	});

	it("position 0 when dice lands exactly on 32", async () => {
		(updatePlayerPosition as Mock).mockResolvedValue(undefined);

		const result = await updatePosition(1, "user1", 26, 6);
		expect(result).toEqual({ newPosition: 0, userId: "user1" });
	});
});

// ── updateMoney ─────────────────────────────────────────────────

describe("updateMoney", () => {
	it("adds positive amount", async () => {
		(updatePlayerMoney as Mock).mockResolvedValue(undefined);

		const result = await updateMoney(1, "user1", 1000, 500);
		expect(result).toEqual({ newBalance: 1500, userId: "user1" });
		expect(updatePlayerMoney).toHaveBeenCalledWith(1, "user1", 1500);
	});

	it("subtracts negative amount (debt)", async () => {
		(updatePlayerMoney as Mock).mockResolvedValue(undefined);

		const result = await updateMoney(1, "user1", 1000, -300);
		expect(result).toEqual({ newBalance: 700, userId: "user1" });
	});
});

// ── buyProperty ─────────────────────────────────────────────────

describe("buyProperty", () => {
	it("assigns property and returns correct shape", async () => {
		(assignProperty as Mock).mockResolvedValue(undefined);

		const result = await buyProperty(1, "user1", 5);
		expect(result).toEqual({ propertyId: 5, userId: "user1" });
		expect(assignProperty).toHaveBeenCalledWith(1, "user1", 5);
	});
});

// ── upgradeProperty ─────────────────────────────────────────────

describe("upgradeProperty", () => {
	it("increments rank and deducts cost", async () => {
		(getPropertyRank as Mock).mockResolvedValue(2);
		(removeProperty as Mock).mockResolvedValue(undefined);
		(assignProperty as Mock).mockResolvedValue(undefined);
		(addPlayerMoney as Mock).mockResolvedValue(undefined);
		(getPlayerMoney as Mock).mockResolvedValue(800);

		const result = await upgradeProperty(1, "user1", 5, 200);
		expect(result).toEqual({
			propertyId: 5,
			userId: "user1",
			newRank: 3,
			newBalance: 800,
		});
		expect(removeProperty).toHaveBeenCalledWith(1, "user1", 5);
		expect(assignProperty).toHaveBeenCalledWith(1, "user1", 5, 3);
		expect(addPlayerMoney).toHaveBeenCalledWith(1, "user1", -200);
	});

	it("returns null at max rank (5)", async () => {
		(getPropertyRank as Mock).mockResolvedValue(5);

		const result = await upgradeProperty(1, "user1", 5, 200);
		expect(result).toBeNull();
		expect(removeProperty).not.toHaveBeenCalled();
	});
});

// ── confirmTrade ────────────────────────────────────────────────

describe("confirmTrade", () => {
	const tradeData = {
		offer: { amount: 100, properties: [1, 2] },
		request: { amount: 50, properties: [3] },
	};

	it("transfers properties and money when accepted", async () => {
		(transferProperties as Mock).mockResolvedValue([
			{ propertyId: 1, toUserId: "user2" },
			{ propertyId: 2, toUserId: "user2" },
		]);
		(transferMoney as Mock).mockResolvedValue(undefined);
		(getPlayerMoney as Mock)
			.mockResolvedValueOnce(900)
			.mockResolvedValueOnce(1100);

		const result = await confirmTrade(
			1,
			"user1",
			"user2",
			tradeData,
			"accepted",
		);

		expect(result.accepted).toBe(true);
		expect(result.fromBalance).toBe(900);
		expect(result.toBalance).toBe(1100);
		expect(transferProperties).toHaveBeenCalled();
		expect(transferMoney).toHaveBeenCalled();
	});

	it("does no transfers when rejected", async () => {
		(getPlayerMoney as Mock)
			.mockResolvedValueOnce(1000)
			.mockResolvedValueOnce(1000);

		const result = await confirmTrade(
			1,
			"user1",
			"user2",
			tradeData,
			"rejected",
		);

		expect(result.accepted).toBe(false);
		expect(transferProperties).not.toHaveBeenCalled();
		expect(transferMoney).not.toHaveBeenCalled();
		expect(result.transferredProperties).toEqual([]);
	});
});
