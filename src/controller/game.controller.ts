import type { Server, Socket } from "socket.io";
import { numberOfPlayersInRoom } from "@/helper";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import {
	addMoney,
	deductMoney,
	getMoney,
	updateMoney,
} from "@/lib/storage/money_storage";
import { updatePosition } from "@/lib/storage/position_storage";
import {
	assignProperty,
	getPropertyRank,
	removeProperty,
} from "@/lib/storage/properties_storage";
import { setTurn } from "@/lib/storage/turn_storage";
import type {
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
} from "@/types/type";

export function registerGameController(
	io: Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>,
	socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
	socket.on(SOCKET_EVENTS.SEND_TURN, (currentTurn: number, roomKey: string) => {
		const totalPlayers = numberOfPlayersInRoom(io, roomKey);
		let nextTurn = currentTurn + 1;
		if (nextTurn > totalPlayers) {
			nextTurn = 1;
		}
		setTurn(roomKey, nextTurn);
		console.log(`DEBUG: Turn changed. Room: ${roomKey}, New Turn: ${nextTurn}`);
		io.to(roomKey).emit(SOCKET_EVENTS.RECEIVE_TURN, nextTurn);
	});
	socket.on(SOCKET_EVENTS.SEND_DICE_ROLL, (diceRoll, roomKey) => {
		io.to(roomKey).emit(SOCKET_EVENTS.GET_DICE_ROLL, diceRoll);
	});
	socket.on(SOCKET_EVENTS.SEND_POSITION, (dice, roomKey) => {
		socket.data.position = (dice + socket.data.position) % 32;
		updatePosition(roomKey, socket.data.userid, socket.data.position);
		io.to(roomKey).emit(
			SOCKET_EVENTS.RECEIVE_POSITION,
			socket.data.position,
			socket.data.userid,
		);
	});
	socket.on(SOCKET_EVENTS.SEND_MONEY, (amount, clientUserId, roomKey) => {
		socket.data.money += amount;
		// Persist money change to room storage
		updateMoney(roomKey, socket.data.userid, socket.data.money);
		console.log(
			`DEBUG: SEND_MONEY received. Amount: ${amount}, Money: ${socket.data.money}, User: ${socket.data.userid}, Room: ${roomKey}`,
		);
		io.to(roomKey).emit(
			SOCKET_EVENTS.RECEIVE_MONEY,
			socket.data.money,
			clientUserId,
		);
		console.log(`DEBUG: Emitted RECEIVE_MONEY to room ${roomKey}`);
	});
	socket.on(SOCKET_EVENTS.BUY_PROPERTY, (propertyId, userId, roomkey) => {
		assignProperty(roomkey, userId, propertyId);
		console.log(
			`DEBUG: BUY_PROPERTY received. PropertyId: ${propertyId}, User: ${userId}, Room: ${roomkey}`,
		);
		io.to(roomkey).emit(SOCKET_EVENTS.PROPERTY_BOUGHT, propertyId, userId);
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
		(fromPlayer, toPlayer, roomKey, tradeData, accepted) => {
			if (accepted === "accepted") {
				if (tradeData.offer) {
					// fromPlayer gives to toPlayer
					const moneyOffered = tradeData.offer.amount;
					const propertyOffered = tradeData.offer.properties;
					deductMoney(roomKey, fromPlayer, moneyOffered);
					addMoney(roomKey, toPlayer, moneyOffered);
					propertyOffered.forEach((propertyId) => {
						const rank = getPropertyRank(roomKey, fromPlayer, propertyId);
						removeProperty(roomKey, fromPlayer, propertyId);
						assignProperty(roomKey, toPlayer, propertyId, rank);
						io.to(roomKey).emit(
							SOCKET_EVENTS.PROPERTY_BOUGHT,
							propertyId,
							toPlayer,
						);
					});
				}

				if (tradeData.request) {
					// fromPlayer takes from toPlayer
					const moneyRequested = tradeData.request.amount;
					const propertyRequested = tradeData.request.properties;
					deductMoney(roomKey, toPlayer, moneyRequested);
					addMoney(roomKey, fromPlayer, moneyRequested);
					propertyRequested.forEach((propertyId) => {
						const rank = getPropertyRank(roomKey, toPlayer, propertyId);
						removeProperty(roomKey, toPlayer, propertyId);
						assignProperty(roomKey, fromPlayer, propertyId, rank);
						io.to(roomKey).emit(
							SOCKET_EVENTS.PROPERTY_BOUGHT,
							propertyId,
							fromPlayer,
						);
					});
				}
			}
			io.to(roomKey).emit(
				SOCKET_EVENTS.RECEIVE_MONEY,
				getMoney(roomKey, fromPlayer),
				fromPlayer,
			);
			io.to(roomKey).emit(
				SOCKET_EVENTS.RECEIVE_MONEY,
				getMoney(roomKey, toPlayer),
				toPlayer,
			);

			io.to(roomKey).emit(
				SOCKET_EVENTS.RECEIVE_CONFIRM_TRADE_OFFER,
				fromPlayer,
				toPlayer,
				roomKey,
				tradeData,
				accepted === "accepted",
			);
		},
	);
	socket.on(
		SOCKET_EVENTS.UPGRADE_PROPERTY,
		(propertyId, userId, roomKey, upgradeCost) => {
			const currentRank = getPropertyRank(roomKey, userId, propertyId);
			if (currentRank < 5) {
				// Upgrade property rank
				removeProperty(roomKey, userId, propertyId);
				assignProperty(roomKey, userId, propertyId, currentRank + 1);
				addMoney(roomKey, userId, -upgradeCost);
				const newBalance = getMoney(roomKey, userId);
				io.to(roomKey).emit(SOCKET_EVENTS.RECEIVE_MONEY, newBalance, userId);
				console.log(
					`DEBUG: UPGRADE_PROPERTY received. PropertyId: ${propertyId}, User: ${userId}, Room: ${roomKey}`,
				);
				io.to(roomKey).emit(
					SOCKET_EVENTS.PROPERTY_UPGRADED,
					propertyId,
					userId,
					currentRank + 1,
				);
			}
		},
	);
}
