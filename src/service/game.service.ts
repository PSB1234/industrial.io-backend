import {
	addPlayerMoney,
	deductPlayerMoney,
	freeJailedPlayer,
	getPlayer,
	getPlayerMoney,
	getPlayersInRoom,
	jailPlayer,
	setPlayerSkipTurn,
	updatePlayerMoney,
	updatePlayerPosition,
} from "@/db/queries/player";
import {
	assignProperty,
	getPlayerPropertiesWithRanks,
	getPropertyRank,
	removeProperty,
} from "@/db/queries/property";
import { setCurrentTurn } from "@/db/queries/room";
import { numberOfPlayersInRoom } from "@/helper";
import { transferMoney, transferProperties } from "@/helper/trade";
import type {
	BuyPropertyResult,
	ChestEventId,
	ChestResolutionReason,
	ChestResolutionResult,
	ChestSpinOutcome,
	ChestSymbol,
	MoneyResult,
	PositionResult,
	TradeConfirmResult,
	TradeData,
	TurnResult,
	UpgradeResult,
} from "@/types/type";

export async function advanceTurn(
	roomKey: string,
	roomId: number,
	currentTurn: number,
): Promise<TurnResult | null> {
	const players = await getPlayersInRoom(roomId);
	const totalPlayers = players.length;
	if (totalPlayers === 0) return null;

	let nextTurn = currentTurn;
	for (let attempt = 0; attempt < totalPlayers; attempt++) {
		nextTurn += 1;
		if (nextTurn > totalPlayers) {
			nextTurn = 1;
		}

		const skippedPlayer = players.find((player) => player.rank === nextTurn);
		if (!skippedPlayer) {
			continue;
		}

		if (skippedPlayer.skipTurn) {
			await setPlayerSkipTurn(roomId, skippedPlayer.id, false);
			continue;
		}

		break;
	}

	await setCurrentTurn(roomKey, nextTurn);
	return { nextTurn };
}

export async function updatePosition(
	roomId: number,
	userId: string,
	currentPosition: number,
	dice: number,
): Promise<PositionResult> {
	const newPosition = (dice + currentPosition) % 32;
	await updatePlayerPosition(roomId, userId, newPosition);
	return { newPosition, userId };
}

export async function setPlayerPosition(
	roomId: number,
	userId: string,
	newPosition: number,
): Promise<PositionResult> {
	await updatePlayerPosition(roomId, userId, newPosition);
	return { newPosition, userId };
}
export async function setPlayerToJail(
	roomId: number,
	userId: string,
): Promise<{ userId: string }> {
	const JAIL_TILE_POSITION = 8;
	await Promise.all([
		jailPlayer(roomId, userId),
		updatePlayerPosition(roomId, userId, JAIL_TILE_POSITION),
	]);
	return { userId };
}
export async function setPlayerFreeFromJail(
	roomId: number,
	userId: string,
): Promise<{ userId: string }> {
	await freeJailedPlayer(roomId, userId);
	return { userId };
}
export async function updateMoney(
	roomId: number,
	userId: string,
	currentMoney: number,
	amount: number,
): Promise<MoneyResult> {
	const newBalance = currentMoney + amount;
	await updatePlayerMoney(roomId, userId, newBalance);
	return { newBalance, userId };
}

export async function deductMoney(
	roomId: number,
	userId: string,
	amount: number,
): Promise<MoneyResult> {
	await deductPlayerMoney(roomId, userId, amount);
	return { newBalance: await getPlayerMoney(roomId, userId), userId };
}
export async function addMoney(
	roomId: number,
	userId: string,
	amount: number,
): Promise<MoneyResult> {
	await addPlayerMoney(roomId, userId, amount);
	return { newBalance: await getPlayerMoney(roomId, userId), userId };
}

export async function buyProperty(
	roomId: number,
	userId: string,
	propertyId: number,
): Promise<BuyPropertyResult> {
	await assignProperty(roomId, userId, propertyId);
	return { propertyId, userId };
}

export async function upgradeProperty(
	roomId: number,
	userId: string,
	propertyId: number,
	upgradeCost: number,
): Promise<UpgradeResult> {
	const currentRank = await getPropertyRank(roomId, userId, propertyId);
	if (currentRank >= 5) return null;

	await removeProperty(roomId, userId, propertyId);
	await assignProperty(roomId, userId, propertyId, currentRank + 1);
	await addPlayerMoney(roomId, userId, -upgradeCost);

	const newBalance = await getPlayerMoney(roomId, userId);
	return {
		propertyId,
		userId,
		newRank: currentRank + 1,
		newBalance,
	};
}

const CHEST_EVENTS = [
	"unexpected-inheritance",
	"startup-success-bonus",
	"tax-refund",
	"property-upgrade-grant",
	"lucky-investment",
	"medical-emergency",
	"property-damage",
	"fraud-scandal",
	"market-crash",
	"investigation-jail",
] as const;

const CHEST_REWARD_BY_SYMBOL: Record<ChestSymbol, number> = {
	COIN: 0,
	STAR: 10,
	GEM: 20,
	BOLT: 30,
	LUCK: 40,
	x2: 50,
};

const LOW_REWARD_EVENTS: ChestEventId[] = [
	"medical-emergency",
	"property-damage",
	"fraud-scandal",
	"market-crash",
	"investigation-jail",
];

const MID_REWARD_EVENTS: ChestEventId[] = [
	"tax-refund",
	"startup-success-bonus",
	"property-upgrade-grant",
	"lucky-investment",
];

const HIGH_REWARD_EVENTS: ChestEventId[] = [
	"unexpected-inheritance",
	"startup-success-bonus",
	"lucky-investment",
	"property-upgrade-grant",
];

const formatRupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

async function applyMoneyDelta(
	roomId: number,
	userId: string,
	amount: number,
): Promise<{ newBalance: number }> {
	if (amount >= 0) {
		return addMoney(roomId, userId, amount);
	}

	return deductMoney(roomId, userId, Math.abs(amount));
}

function resolveChestScore(spin: ChestSpinOutcome | undefined): number | undefined {
	if (!spin) return undefined;
	const symbolScore = spin.symbols.reduce(
		(total, symbol) => total + CHEST_REWARD_BY_SYMBOL[symbol],
		0,
	);

	if (!Number.isFinite(spin.rewardScore)) {
		return symbolScore;
	}

	// Prefer backend-derived value if client payload was tampered.
	return symbolScore;
}

function getEventPoolByScore(score: number): ChestEventId[] {
	if (score >= 90) return HIGH_REWARD_EVENTS;
	if (score >= 50) return MID_REWARD_EVENTS;
	return LOW_REWARD_EVENTS;
}

function pickEventBySpin(spin: ChestSpinOutcome | undefined): ChestEventId {
	const score = resolveChestScore(spin);
	if (typeof score !== "number") {
		return CHEST_EVENTS[Math.floor(Math.random() * CHEST_EVENTS.length)] ?? CHEST_EVENTS[0];
	}

	const pool = getEventPoolByScore(score);
	return pool[Math.floor(Math.random() * pool.length)] ?? CHEST_EVENTS[0];
}

export async function resolveChestEvent(
	roomId: number,
	userId: string,
	reason: ChestResolutionReason,
	spin?: ChestSpinOutcome,
): Promise<ChestResolutionResult> {
	const player = await getPlayer(roomId, userId);
	if (!player) {
		throw new Error("Player not found");
	}

	const eventId = pickEventBySpin(spin);

	switch (eventId) {
		case "unexpected-inheritance": {
			const result = await applyMoneyDelta(roomId, userId, 5000);
			return {
				eventId,
				title: "Unexpected Inheritance",
				description: "You receive ₹5,000 from a distant relative.",
				rewardText: "+" + formatRupees(5000),
				reason,
				moneyDelta: 5000,
				newBalance: result.newBalance,
			};
		}
		case "startup-success-bonus": {
			const result = await applyMoneyDelta(roomId, userId, 3000);
			return {
				eventId,
				title: "Startup Success Bonus",
				description: "Your side business goes viral — collect ₹3,000.",
				rewardText: "+" + formatRupees(3000),
				reason,
				moneyDelta: 3000,
				newBalance: result.newBalance,
			};
		}
		case "tax-refund": {
			const result = await applyMoneyDelta(roomId, userId, 2000);
			return {
				eventId,
				title: "Tax Refund",
				description: "You overpaid taxes — collect ₹2,000.",
				rewardText: "+" + formatRupees(2000),
				reason,
				moneyDelta: 2000,
				newBalance: result.newBalance,
			};
		}
		case "property-upgrade-grant": {
			const ownedProperties = await getPlayerPropertiesWithRanks(
				roomId,
				userId,
			);
			const target = [...ownedProperties].sort((a, b) => a.id - b.id)[0];

			if (!target) {
				return {
					eventId,
					title: "Property Upgrade Grant",
					description:
						"Government funds your development, but you do not own a property yet.",
					rewardText: "No property to upgrade",
					reason,
					usedFallback: true,
				};
			}

			const upgraded = await upgradeProperty(roomId, userId, target.id, 0);
			if (!upgraded) {
				return {
					eventId,
					title: "Property Upgrade Grant",
					description:
						"Government funds your development, but that property is already maxed out.",
					rewardText: "No upgrade applied",
					reason,
					propertyId: target.id,
					usedFallback: true,
				};
			}

			return {
				eventId,
				title: "Property Upgrade Grant",
				description:
					"Government funds your development — upgrade one property for free.",
				rewardText: `Free upgrade on property ${target.id}`,
				reason,
				propertyId: target.id,
				newRank: upgraded.newRank,
				newBalance: upgraded.newBalance,
			};
		}
		case "lucky-investment": {
			const delta = Math.floor(player.money * 0.2);
			const result = await applyMoneyDelta(roomId, userId, delta);
			return {
				eventId,
				title: "Lucky Investment",
				description: "Your stocks double — gain 20% of your current cash.",
				rewardText: `+${formatRupees(delta)}`,
				reason,
				moneyDelta: delta,
				newBalance: result.newBalance,
			};
		}
		case "medical-emergency": {
			const result = await applyMoneyDelta(roomId, userId, -2500);
			return {
				eventId,
				title: "Medical Emergency",
				description: "Pay ₹2,500 for hospital expenses.",
				rewardText: `-${formatRupees(2500)}`,
				reason,
				moneyDelta: -2500,
				newBalance: result.newBalance,
			};
		}
		case "property-damage": {
			const amount = await ownedPropertyDamage(roomId, userId);
			const result = await applyMoneyDelta(roomId, userId, -amount);
			return {
				eventId,
				title: "Property Damage",
				description: "Repairs needed — pay ₹1,000 per property owned.",
				rewardText: `-${formatRupees(amount)}`,
				reason,
				moneyDelta: -amount,
				newBalance: result.newBalance,
			};
		}
		case "fraud-scandal": {
			if (Math.random() < 0.5) {
				const result = await applyMoneyDelta(roomId, userId, -3000);
				return {
					eventId,
					title: "Fraud Scandal",
					description: "Pay ₹3,000 fine or skip next turn.",
					rewardText: `-${formatRupees(3000)}`,
					reason,
					moneyDelta: -3000,
					newBalance: result.newBalance,
				};
			}

			await setPlayerSkipTurn(roomId, userId, true);
			return {
				eventId,
				title: "Fraud Scandal",
				description: "Pay ₹3,000 fine or skip next turn.",
				rewardText: "Skip next turn",
				reason,
				skipTurn: true,
			};
		}
		case "market-crash": {
			const amount = Math.floor(player.money * 0.25);
			const result =
				amount > 0
					? await applyMoneyDelta(roomId, userId, -amount)
					: { newBalance: player.money };
			return {
				eventId,
				title: "Market Crash",
				description: "Lose 25% of your total cash.",
				rewardText: amount > 0 ? `-${formatRupees(amount)}` : "No cash lost",
				reason,
				moneyDelta: -amount,
				newBalance: result.newBalance,
			};
		}
		case "investigation-jail": {
			await setPlayerToJail(roomId, userId);
			return {
				eventId,
				title: "Investigation",
				description:
					"Move directly to jail, do not pass GO, do not collect money.",
				rewardText: "Move to jail",
				reason,
				position: 8,
				behindBars: true,
			};
		}
	}

	throw new Error("Unknown chest event");
}

async function ownedPropertyDamage(roomId: number, userId: string) {
	const ownedProperties = await getPlayerPropertiesWithRanks(roomId, userId);
	return ownedProperties.length * 1000;
}

export async function confirmTrade(
	roomId: number,
	fromPlayer: string,
	toPlayer: string,
	tradeData: { offer: TradeData; request: TradeData },
	accepted: boolean,
): Promise<TradeConfirmResult> {
	const transferredProperties: Array<{
		propertyId: number;
		toUserId: string;
	}> = [];

	if (accepted) {
		if (tradeData.offer) {
			const [transferred] = await Promise.all([
				transferProperties(
					roomId,
					fromPlayer,
					toPlayer,
					tradeData.offer.properties,
				),
				transferMoney(roomId, fromPlayer, toPlayer, tradeData.offer.amount),
			]);
			transferredProperties.push(...transferred);
		}

		if (tradeData.request) {
			const [transferred] = await Promise.all([
				transferProperties(
					roomId,
					toPlayer,
					fromPlayer,
					tradeData.request.properties,
				),
				transferMoney(roomId, toPlayer, fromPlayer, tradeData.request.amount),
			]);
			transferredProperties.push(...transferred);
		}
	}

	const fromBalance = await getPlayerMoney(roomId, fromPlayer);
	const toBalance = await getPlayerMoney(roomId, toPlayer);

	return {
		fromPlayer,
		toPlayer,
		fromBalance,
		toBalance,
		accepted,
		tradeData,
		transferredProperties,
	};
}
