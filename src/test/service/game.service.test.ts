import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { getPlayerMoney } from "@/db/queries/player";
import { transferMoney, transferProperties } from "@/helper/trade";
import { confirmTrade } from "@/service/game.service";

vi.mock("@/db/queries/player");
vi.mock("@/helper/trade");

describe("game.service.confirmTrade", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const tradeData = {
		offer: { properties: [1, 2], amount: 100 },
		request: { properties: [3], amount: 0 },
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
			true,
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
			false,
		);

		expect(result.accepted).toBe(false);
		expect(transferProperties).not.toHaveBeenCalled();
		expect(transferMoney).not.toHaveBeenCalled();
		expect(result.transferredProperties).toEqual([]);
	});
});
