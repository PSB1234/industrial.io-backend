import {
	addPlayerMoney,
	deductPlayerMoney,
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
import type {
	BuyPropertyResult,
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
	const totalPlayers = await numberOfPlayersInRoom(roomId);
	if (totalPlayers === 0) return null;

	let nextTurn = currentTurn + 1;
	if (nextTurn > totalPlayers) {
		nextTurn = 1;
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
