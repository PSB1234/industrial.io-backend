import { resolveRoomId } from "@/helper/room_utils";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import * as gameService from "@/service/game.service";
import type { AppServer, AppSocket } from "@/types/type";

export function registerGameController(io: AppServer, socket: AppSocket) {
	socket.on(
		SOCKET_EVENTS.SEND_TURN,
		async (currentTurn: number, roomKey: string) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const result = await gameService.advanceTurn(
					roomKey,
					roomId,
					currentTurn,
				);
				if (!result) return;

				io.to(roomKey).emit(SOCKET_EVENTS.RECEIVE_TURN, result.nextTurn);
			} catch (error) {
				console.error("Error advancing turn:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to advance turn");
			}
		},
	);

	socket.on(SOCKET_EVENTS.SEND_DICE_ROLL, (diceRoll, roomKey) => {
		io.to(roomKey).emit(SOCKET_EVENTS.GET_DICE_ROLL, diceRoll);
	});

	socket.on(SOCKET_EVENTS.SEND_POSITION, async (dice, roomKey) => {
		try {
			const roomId = await resolveRoomId(roomKey, socket);
			if (!roomId) return;

			const result = await gameService.updatePosition(
				roomId,
				socket.data.userid,
				socket.data.position,
				dice,
			);

			socket.data.position = result.newPosition;

			io.to(roomKey).emit(
				SOCKET_EVENTS.RECEIVE_POSITION,
				result.newPosition,
				result.userId,
			);
		} catch (error) {
			console.error("Error updating position:", error);
			socket.emit(SOCKET_EVENTS.ERROR, "Failed to update position");
		}
	});

	socket.on(SOCKET_EVENTS.SEND_MONEY, async (amount, clientUserId, roomKey) => {
		try {
			const roomId = await resolveRoomId(roomKey, socket);
			if (!roomId) return;

			const result = await gameService.updateMoney(
				roomId,
				socket.data.userid,
				socket.data.money,
				amount,
			);

			socket.data.money = result.newBalance;

			io.to(roomKey).emit(
				SOCKET_EVENTS.RECEIVE_MONEY,
				result.newBalance,
				clientUserId,
			);
		} catch (error) {
			console.error("Error updating money:", error);
			socket.emit(SOCKET_EVENTS.ERROR, "Failed to update money");
		}
	});

	socket.on(SOCKET_EVENTS.BUY_PROPERTY, async (propertyId, userId, roomKey) => {
		try {
			const roomId = await resolveRoomId(roomKey, socket);
			if (!roomId) return;

			const result = await gameService.buyProperty(roomId, userId, propertyId);

			io.to(roomKey).emit(
				SOCKET_EVENTS.PROPERTY_BOUGHT,
				result.propertyId,
				result.userId,
			);
		} catch (error) {
			console.error("Error buying property:", error);
			socket.emit(SOCKET_EVENTS.ERROR, "Failed to buy property");
		}
	});

	socket.on(
		SOCKET_EVENTS.SEND_TRADE_OFFER,
		(userId, playerId, roomKey, tradeData) => {
			io.to(roomKey).emit(
				SOCKET_EVENTS.RECEIVE_TRADE_OFFER,
				userId,
				playerId,
				tradeData,
			);
		},
	);

	socket.on(
		SOCKET_EVENTS.CONFIRM_TRADE_OFFER,
		async (fromPlayer, toPlayer, roomKey, tradeData, accepted) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const result = await gameService.confirmTrade(
					roomId,
					fromPlayer,
					toPlayer,
					tradeData,
					accepted,
				);

				// Emit property transfers
				for (const transfer of result.transferredProperties) {
					io.to(roomKey).emit(
						SOCKET_EVENTS.PROPERTY_BOUGHT,
						transfer.propertyId,
						transfer.toUserId,
					);
				}

				// Broadcast updated balances
				io.to(roomKey).emit(
					SOCKET_EVENTS.RECEIVE_MONEY,
					result.fromBalance,
					result.fromPlayer,
				);
				io.to(roomKey).emit(
					SOCKET_EVENTS.RECEIVE_MONEY,
					result.toBalance,
					result.toPlayer,
				);

				io.to(roomKey).emit(
					SOCKET_EVENTS.RECEIVE_CONFIRM_TRADE_OFFER,
					result.fromPlayer,
					result.toPlayer,
					roomKey,
					result.tradeData,
					result.accepted,
				);
			} catch (error) {
				console.error("Error confirming trade:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to confirm trade");
			}
		},
	);

	socket.on(
		SOCKET_EVENTS.UPGRADE_PROPERTY,
		async (propertyId, userId, roomKey, upgradeCost) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const result = await gameService.upgradeProperty(
					roomId,
					userId,
					propertyId,
					upgradeCost,
				);
				if (!result) return;

				io.to(roomKey).emit(
					SOCKET_EVENTS.RECEIVE_MONEY,
					result.newBalance,
					result.userId,
				);
				io.to(roomKey).emit(
					SOCKET_EVENTS.PROPERTY_UPGRADED,
					result.propertyId,
					result.userId,
					result.newRank,
				);
			} catch (error) {
				console.error("Error upgrading property:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to upgrade property");
			}
		},
	);
}
