import { getCurrentTurn } from "@/db/queries/room";
import {
	handleActivityConfirmation,
	resetInactivityTimer,
} from "@/helper/inactivity_helpers";
import { resolveRoomId } from "@/helper/room_utils";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import * as gameService from "@/service/game.service";
import type { AppServer, AppSocket } from "@/types/type";

export function registerGameController(io: AppServer, socket: AppSocket) {
	socket.on(
		SOCKET_EVENTS.SEND_TURN,
		async (_currentTurn: number, roomKey: string) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const authoritativeTurn = await getCurrentTurn(roomKey);
				if (socket.data.rank !== authoritativeTurn) {
					socket.emit(SOCKET_EVENTS.ERROR, "Cheeky move! It's not your turn.");
					return;
				}

				const result = await gameService.advanceTurn(
					roomKey,
					roomId,
					authoritativeTurn,
				);
				if (!result) return;

				io.to(roomKey).emit(SOCKET_EVENTS.RECEIVE_TURN, result.nextTurn);
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error advancing turn:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to advance turn");
			}
		},
	);

	socket.on(
		SOCKET_EVENTS.SEND_DICE_ROLL,
		async (diceRoll: number, roomKey: string) => {
			const currentTurn = await getCurrentTurn(roomKey);
			if (socket.data.rank !== currentTurn) {
				socket.emit(
					SOCKET_EVENTS.ERROR,
					"Cheeky move! It's not your turn to roll.",
				);
				return;
			}
			io.to(roomKey).emit(SOCKET_EVENTS.GET_DICE_ROLL, diceRoll);
			resetInactivityTimer(io, roomKey);
		},
	);

	socket.on(SOCKET_EVENTS.SEND_POSITION, async (dice: number, roomKey: string) => {
		try {
			const roomId = await resolveRoomId(roomKey, socket);
			if (!roomId) return;

			const currentTurn = await getCurrentTurn(roomKey);
			if (socket.data.rank !== currentTurn) {
				socket.emit(
					SOCKET_EVENTS.ERROR,
					"Cheeky move! You can't move out of turn.",
				);
				return;
			}

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
			resetInactivityTimer(io, roomKey);
		} catch (error) {
			console.error("Error updating position:", error);
			socket.emit(SOCKET_EVENTS.ERROR, "Failed to update position");
		}
	});

	socket.on(
		SOCKET_EVENTS.SEND_MONEY,
		async (amount: number, clientUserId: string, roomKey: string) => {
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
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error updating money:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to update money");
			}
		},
	);

	socket.on(
		SOCKET_EVENTS.BUY_PROPERTY,
		async (propertyId: number, userId: string, roomKey: string) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const currentTurn = await getCurrentTurn(roomKey);
				if (socket.data.rank !== currentTurn) {
					socket.emit(
						SOCKET_EVENTS.ERROR,
						"Cheeky move! You can't buy properties out of turn.",
					);
					return;
				}

				const result = await gameService.buyProperty(roomId, userId, propertyId);

				io.to(roomKey).emit(
					SOCKET_EVENTS.PROPERTY_BOUGHT,
					result.propertyId,
					result.userId,
				);
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error buying property:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to buy property");
			}
		},
	);

	socket.on(
		SOCKET_EVENTS.SEND_TRADE_OFFER,
		(userId: string, playerId: string, roomKey: string, tradeData: any) => {
			io.to(roomKey).emit(
				SOCKET_EVENTS.RECEIVE_TRADE_OFFER,
				userId,
				playerId,
				tradeData,
			);
			resetInactivityTimer(io, roomKey);
		},
	);

	socket.on(
		SOCKET_EVENTS.CONFIRM_TRADE_OFFER,
		async (
			fromPlayer: string,
			toPlayer: string,
			roomKey: string,
			tradeData: any,
			status: "accepted" | "rejected",
		) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const result = await gameService.confirmTrade(
					roomId,
					fromPlayer,
					toPlayer,
					tradeData,
					status === "accepted",
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
					status,
				);
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error confirming trade:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to confirm trade");
			}
		},
	);

	socket.on(
		SOCKET_EVENTS.UPGRADE_PROPERTY,
		async (
			propertyId: number,
			userId: string,
			roomKey: string,
			upgradeCost: number,
		) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const currentTurn = await getCurrentTurn(roomKey);
				if (socket.data.rank !== currentTurn) {
					socket.emit(
						SOCKET_EVENTS.ERROR,
						"Cheeky move! You can't upgrade properties out of turn.",
					);
					return;
				}

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
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error upgrading property:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to upgrade property");
			}
		},
	);

	socket.on(SOCKET_EVENTS.CONFIRM_ACTIVITY, (roomKey: string) => {
		handleActivityConfirmation(io, roomKey);
	});
}
