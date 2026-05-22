import { getPlayer } from "@/db/queries/player";
import { getCurrentTurn } from "@/db/queries/room";
import { DEFAULT_PASS_START_REWARD } from "@/helper/default_value";
import {
	handleActivityConfirmation,
	resetInactivityTimer,
} from "@/helper/inactivity_helpers";
import { resolveRoomId } from "@/helper/room_utils";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import {
	clearLastDiceRoll,
	getLastDiceRoll,
	setLastDiceRoll,
} from "@/lib/storage/dice_storage";
import {
	clearJailRollAttemptsForPlayer,
	incrementJailRollAttempts,
} from "@/lib/storage/jail_storage";
import { getTurnCount, incrementTurnCount } from "@/lib/storage/turn_storage";
import { collectTaxFromPlayer } from "@/lib/utils/collect_tax";
import * as gameService from "@/service/game.service";
import type {
	AppServer,
	AppSocket,
	ChestResolutionResult,
	ChestSpinOutcome,
	MoneyUpdatePayload,
	MoneyUpdateSource,
	PositionResult,
	TradeData,
} from "@/types/type";

const VALID_CHEST_SYMBOLS = new Set([
	"COIN",
	"STAR",
	"GEM",
	"BOLT",
	"LUCK",
	"x2",
]);

interface AuctionState {
	propertyId: number;
	basePrice: number;
	currentBid: number;
	highestBidder: string | null;
	initiatorId: string;
	timer: NodeJS.Timeout | null;
}
const roomAuctions = new Map<string, AuctionState>();

function sanitizeChestSpin(
	spin: ChestSpinOutcome | undefined,
): ChestSpinOutcome | undefined {
	if (!spin || !Array.isArray(spin.symbols) || spin.symbols.length !== 3) {
		return undefined;
	}

	if (!spin.symbols.every((symbol) => VALID_CHEST_SYMBOLS.has(symbol))) {
		return undefined;
	}

	const rewardScore = Number.isFinite(spin.rewardScore) ? spin.rewardScore : 0;
	return {
		symbols: [spin.symbols[0], spin.symbols[1], spin.symbols[2]],
		rewardScore,
	};
}

export function registerGameController(io: AppServer, socket: AppSocket) {
	const emitMoneyUpdate = (roomKey: string, payload: MoneyUpdatePayload) => {
		io.to(roomKey).emit(
			SOCKET_EVENTS.RECEIVE_MONEY,
			payload.newBalance,
			payload.userId,
		);
		io.to(roomKey).emit(SOCKET_EVENTS.RECEIVE_MONEY_UPDATE, payload);
	};

	socket.on(
		SOCKET_EVENTS.RESOLVE_CHEST,
		async (
			roomKey: string,
			reason: "stopped" | "timeout",
			spin: ChestSpinOutcome | undefined,
			ack: (result: ChestResolutionResult) => void,
		) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const currentTurn = await getCurrentTurn(roomKey);
				if (socket.data.rank !== currentTurn) {
					socket.emit(
						SOCKET_EVENTS.ERROR,
						"Cheeky move! You can't resolve chest out of turn.",
					);
					return;
				}

				const safeSpin = sanitizeChestSpin(spin);

				const result = await gameService.resolveChestEvent(
					roomId,
					socket.data.userid,
					reason,
					safeSpin,
				);

				if (typeof result.newBalance === "number") {
					socket.data.money = result.newBalance;
					emitMoneyUpdate(roomKey, {
						userId: socket.data.userid,
						newBalance: result.newBalance,
						delta: result.moneyDelta ?? 0,
						source: "chest",
						eventId: result.eventId,
						eventTitle: result.title,
					});
				}

				if (
					typeof result.propertyId === "number" &&
					typeof result.newRank === "number"
				) {
					io.to(roomKey).emit(
						SOCKET_EVENTS.PROPERTY_UPGRADED,
						result.propertyId,
						socket.data.userid,
						result.newRank,
					);
				}

				if (result.position === 8 || result.behindBars) {
					socket.data.position = 8;
					socket.data.behindBars = true;
					io.to(roomKey).emit(
						SOCKET_EVENTS.RECEIVE_POSITION,
						8,
						socket.data.userid,
						getTurnCount(roomKey),
					);
					io.to(roomKey).emit(
						SOCKET_EVENTS.JAIL_STATUS_CHANGED,
						socket.data.userid,
						true,
					);
				}

				if (result.skipTurn) {
					socket.data.skipTurn = true;
				}

				resetInactivityTimer(io, roomKey);
				ack(result);
			} catch (error) {
				console.error("Error resolving chest:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to resolve chest");
			}
		},
	);
	socket.on(
		SOCKET_EVENTS.ACTIVATE_JAIL_CARD,
		async (
			roomKey: string,
			callback?: (success: boolean, message?: string) => void,
		) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) {
					if (callback) callback(false, "Room not found");
					return;
				}

				const authoritativeTurn = await getCurrentTurn(roomKey);
				if (socket.data.rank !== authoritativeTurn) {
					socket.emit(SOCKET_EVENTS.ERROR, "Cheeky move! It's not your turn.");
					if (callback) callback(false, "Not your turn");
					return;
				}

				const player = await gameService.getPlayer(roomId, socket.data.userid);
				if (!player || !player.behindBars || player.getOutOfJailCards <= 0) {
					if (callback) callback(false, "Cannot use get out of jail card");
					return;
				}

				// Free player and decrement their card
				await gameService.updatePlayerGetOutOfJailCard(
					roomId,
					socket.data.userid,
					-1,
				);
				await gameService.setPlayerFreeFromJail(roomId, socket.data.userid);
				socket.data.behindBars = false;

				io.to(roomKey).emit(
					SOCKET_EVENTS.JAIL_STATUS_CHANGED,
					socket.data.userid,
					false,
				);

				// Consume turn
				const result = await gameService.advanceTurn(
					roomKey,
					roomId,
					authoritativeTurn,
				);
				if (result) {
					io.to(roomKey).emit(SOCKET_EVENTS.RECEIVE_TURN, result.nextTurn);
				}

				resetInactivityTimer(io, roomKey);
				if (callback) callback(true);
			} catch (error) {
				console.error("Error activating jail card:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to activate jail card");
				if (callback) callback(false, "Server error");
			}
		},
	);
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

				const lastDice = getLastDiceRoll(roomKey, socket.data.userid);
				if (lastDice === 6) {
					clearLastDiceRoll(roomKey, socket.data.userid);
					io.to(roomKey).emit(SOCKET_EVENTS.RECEIVE_TURN, authoritativeTurn);
					resetInactivityTimer(io, roomKey);
					return;
				}

				const result = await gameService.advanceTurn(
					roomKey,
					roomId,
					authoritativeTurn,
				);
				if (!result) return;
				clearLastDiceRoll(roomKey, socket.data.userid);

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
			setLastDiceRoll(roomKey, socket.data.userid, diceRoll);
			io.to(roomKey).emit(SOCKET_EVENTS.GET_DICE_ROLL, diceRoll);
			resetInactivityTimer(io, roomKey);
		},
	);

	socket.on(
		SOCKET_EVENTS.SEND_POSITION,
		async (dice: number, roomKey: string) => {
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

				setLastDiceRoll(roomKey, socket.data.userid, dice);

				const player = await getPlayer(roomId, socket.data.userid);
				if (!player) {
					socket.emit(SOCKET_EVENTS.ERROR, "Player not found");
					return;
				}

				let result: PositionResult;
				if (player.behindBars) {
					if (dice === 6) {
						await gameService.setPlayerFreeFromJail(roomId, socket.data.userid);
						clearJailRollAttemptsForPlayer(roomKey, socket.data.userid);
						socket.data.behindBars = false;
						io.to(roomKey).emit(
							SOCKET_EVENTS.JAIL_STATUS_CHANGED,
							socket.data.userid,
							false,
						);
						result = await gameService.updatePosition(
							roomId,
							socket.data.userid,
							player.position,
							dice,
						);
					} else {
						const attempts = incrementJailRollAttempts(
							roomKey,
							socket.data.userid,
						);

						if (attempts >= 3) {
							await gameService.setPlayerFreeFromJail(
								roomId,
								socket.data.userid,
							);
							clearJailRollAttemptsForPlayer(roomKey, socket.data.userid);
							socket.data.behindBars = false;
							io.to(roomKey).emit(
								SOCKET_EVENTS.JAIL_STATUS_CHANGED,
								socket.data.userid,
								false,
							);
						}

						result = {
							newPosition: player.position,
							userId: socket.data.userid,
						};
					}
				} else {
					result = await gameService.updatePosition(
						roomId,
						socket.data.userid,
						player.position,
						dice,
					);
				}

				socket.data.position = result.newPosition;
				const turnCount = incrementTurnCount(roomKey);

				if (player.position + dice >= 32) {
					const passStartMoney = await gameService.addMoney(
						roomId,
						socket.data.userid,
						DEFAULT_PASS_START_REWARD,
					);
					socket.data.money = passStartMoney.newBalance;
					emitMoneyUpdate(roomKey, {
						userId: socket.data.userid,
						newBalance: passStartMoney.newBalance,
						delta: DEFAULT_PASS_START_REWARD,
						source: "pass-start",
					});
				}

				io.to(roomKey).emit(
					SOCKET_EVENTS.RECEIVE_POSITION,
					result.newPosition,
					result.userId,
					turnCount,
				);
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error updating position:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to update position");
			}
		},
	);

	socket.on(
		SOCKET_EVENTS.SEND_MONEY,
		async (
			amount: number,
			clientUserId: string,
			roomKey: string,
			source: MoneyUpdateSource = "manual",
			targetUserId?: string,
		) => {
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

				emitMoneyUpdate(roomKey, {
					userId: clientUserId,
					newBalance: result.newBalance,
					delta: amount,
					source,
					targetUserId,
				});
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

				const result = await gameService.buyProperty(
					roomId,
					userId,
					propertyId,
				);

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
		SOCKET_EVENTS.SELL_PROPERTY,
		async (
			propertyId: number,
			userId: string,
			roomKey: string,
			refundAmount: number,
		) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const currentTurn = await getCurrentTurn(roomKey);
				if (socket.data.rank !== currentTurn) {
					socket.emit(
						SOCKET_EVENTS.ERROR,
						"Cheeky move! You can't sell properties out of turn.",
					);
					return;
				}

				const result = await gameService.sellOrDowngradeProperty(
					roomId,
					userId,
					propertyId,
					refundAmount,
				);
				if (!result) return;

				emitMoneyUpdate(roomKey, {
					userId: result.userId,
					newBalance: result.newBalance,
					delta: refundAmount,
					source: "sell",
				});
				io.to(roomKey).emit(
					SOCKET_EVENTS.PROPERTY_SOLD,
					result.propertyId,
					result.userId,
					result.newRank,
				);
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error selling property:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to sell property");
			}
		},
	);

	socket.on(
		SOCKET_EVENTS.START_AUCTION,
		async (propertyId: number, userId: string, roomKey: string) => {
			try {
				const currentTurn = await getCurrentTurn(roomKey);
				if (socket.data.rank !== currentTurn) {
					socket.emit(
						SOCKET_EVENTS.ERROR,
						"Cheeky move! You can't start an auction out of turn.",
					);
					return;
				}

				if (roomAuctions.has(roomKey)) {
					socket.emit(
						SOCKET_EVENTS.ERROR,
						"An auction is already in progress.",
					);
					return;
				}

				const state: AuctionState = {
					propertyId,
					basePrice: 0,
					currentBid: 0,
					highestBidder: null,
					initiatorId: userId,
					timer: null,
				};

				const startTimer = () => {
					return setTimeout(async () => {
						const auction = roomAuctions.get(roomKey);
						if (!auction) return;

						roomAuctions.delete(roomKey);

						const roomId = await resolveRoomId(roomKey, socket);
						if (!roomId) return;

						const winnerId = auction.highestBidder || auction.initiatorId;
						const winningBid = auction.highestBidder ? auction.currentBid : 0;

						try {
							const result = await gameService.buyProperty(
								roomId,
								winnerId,
								auction.propertyId,
							);

							if (winningBid > 0) {
								const updatedMoney = await gameService.deductMoney(
									roomId,
									winnerId,
									winningBid,
								);
								emitMoneyUpdate(roomKey, {
									userId: winnerId,
									newBalance: updatedMoney.newBalance,
									delta: -winningBid,
									source: "buy-property",
								});
							}

							io.to(roomKey).emit(SOCKET_EVENTS.AUCTION_ENDED, auction.propertyId, winnerId, winningBid);
							io.to(roomKey).emit(
								SOCKET_EVENTS.PROPERTY_BOUGHT,
								result.propertyId,
								result.userId,
							);
						} catch (error) {
							console.error("Error ending auction:", error);
						}
					}, 5000);
				};

				state.timer = startTimer();
				roomAuctions.set(roomKey, state);

				io.to(roomKey).emit(SOCKET_EVENTS.AUCTION_STARTED, propertyId, state.basePrice, state.currentBid, state.highestBidder);
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error starting auction:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to start auction");
			}
		},
	);

	socket.on(
		SOCKET_EVENTS.PLACE_BID,
		async (bidAmount: number, userId: string, roomKey: string) => {
			try {
				const auction = roomAuctions.get(roomKey);
				if (!auction) {
					socket.emit(SOCKET_EVENTS.ERROR, "No active auction found.");
					return;
				}

				if (bidAmount <= auction.currentBid) {
					socket.emit(
						SOCKET_EVENTS.ERROR,
						"Bid must be higher than current bid.",
					);
					return;
				}

				// Verify player has enough money (Optional but safe)
				// For now relying on frontend to disable button if insufficient funds.
				// Update auction
				auction.currentBid = bidAmount;
				auction.highestBidder = userId;

				// Reset timer
				if (auction.timer) clearTimeout(auction.timer);

				auction.timer = setTimeout(async () => {
					const auc = roomAuctions.get(roomKey);
					if (!auc) return;

					roomAuctions.delete(roomKey);

					const roomId = await resolveRoomId(roomKey, socket);
					if (!roomId) return;

					const winnerId = auc.highestBidder || auc.initiatorId;
					const winningBid = auc.highestBidder ? auc.currentBid : 0;

					try {
						const result = await gameService.buyProperty(
							roomId,
							winnerId,
							auc.propertyId,
						);

						if (winningBid > 0) {
							const updatedMoney = await gameService.deductMoney(
								roomId,
								winnerId,
								winningBid,
							);
							emitMoneyUpdate(roomKey, {
								userId: winnerId,
								newBalance: updatedMoney.newBalance,
								delta: -winningBid,
								source: "buy-property",
							});
						}

						io.to(roomKey).emit(SOCKET_EVENTS.AUCTION_ENDED, auc.propertyId, winnerId, winningBid);
						io.to(roomKey).emit(
							SOCKET_EVENTS.PROPERTY_BOUGHT,
							result.propertyId,
							result.userId,
						);
					} catch (error) {
						console.error("Error ending auction:", error);
					}
				}, 5000);

				io.to(roomKey).emit(SOCKET_EVENTS.AUCTION_UPDATED, auction.propertyId, auction.currentBid, auction.highestBidder);
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error placing bid:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to place bid");
			}
		},
	);

	socket.on(
		SOCKET_EVENTS.SEND_TRADE_OFFER,
		(
			userId: string,
			playerId: string,
			roomKey: string,
			tradeData: {
				offer: TradeData;
				request: TradeData;
			},
		) => {
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
			tradeData: {
				offer: TradeData;
				request: TradeData;
			},
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

				const fromDelta =
					status === "accepted"
						? -tradeData.offer.amount + tradeData.request.amount
						: 0;
				const toDelta =
					status === "accepted"
						? -tradeData.request.amount + tradeData.offer.amount
						: 0;

				emitMoneyUpdate(roomKey, {
					userId: result.fromPlayer,
					newBalance: result.fromBalance,
					delta: fromDelta,
					source: "trade",
					targetUserId: result.toPlayer,
				});
				emitMoneyUpdate(roomKey, {
					userId: result.toPlayer,
					newBalance: result.toBalance,
					delta: toDelta,
					source: "trade",
					targetUserId: result.fromPlayer,
				});

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

				emitMoneyUpdate(roomKey, {
					userId: result.userId,
					newBalance: result.newBalance,
					delta: -upgradeCost,
					source: "upgrade",
				});
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

	socket.on(
		SOCKET_EVENTS.COLLECT_TAX,
		async (userId: string, roomKey: string) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;
				const amountToBeRemoved = await collectTaxFromPlayer(userId, roomId);
				const result = await gameService.deductMoney(
					roomId,
					userId,
					amountToBeRemoved,
				);

				socket.data.money = result.newBalance;

				emitMoneyUpdate(roomKey, {
					userId,
					newBalance: result.newBalance,
					delta: -amountToBeRemoved,
					source: "tax",
				});
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error updating money:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to update money");
			}
		},
	);

	socket.on(
		SOCKET_EVENTS.GO_TO_JAIL,
		async (userId: string, roomKey: string) => {
			try {
				const roomId = await resolveRoomId(roomKey, socket);
				if (!roomId) return;

				const JAIL_TILE_POSITION = 8;
				const result = await gameService.setPlayerToJail(roomId, userId);
				clearJailRollAttemptsForPlayer(roomKey, userId);

				if (socket.data.userid === userId) {
					socket.data.position = JAIL_TILE_POSITION;
					socket.data.behindBars = true;
				}

				io.to(roomKey).emit(
					SOCKET_EVENTS.RECEIVE_POSITION,
					JAIL_TILE_POSITION,
					result.userId,
					getTurnCount(roomKey),
				);
				io.to(roomKey).emit(
					SOCKET_EVENTS.JAIL_STATUS_CHANGED,
					result.userId,
					true,
				);
				resetInactivityTimer(io, roomKey);
			} catch (error) {
				console.error("Error moving player to jail:", error);
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to move player to jail");
			}
		},
	);
}
