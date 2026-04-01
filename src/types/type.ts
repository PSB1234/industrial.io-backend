import type { Server, Socket } from "socket.io";
import type z from "zod";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import type { createRoomSchema } from "@/types/zod";
export type PlayerSnapshot = {
	id: string;
	socketid: string;
	username: string;
	rank: number;
	position: number;
	money: number;
	color: string;
	votes: number;
	properties: { id: number; rank: number }[];
	leader: boolean;
};
export interface ServerToClientEvents {
	[SOCKET_EVENTS.USER_CONNECTED]: (username: string) => void;
	[SOCKET_EVENTS.USER_DISCONNECTED]: (userId: string) => void;
	[SOCKET_EVENTS.USERNAME_ASSIGNED]: (username: string) => void;
	[SOCKET_EVENTS.GET_ALL_ROOMS]: (roomsData: RoomData[]) => void;
	[SOCKET_EVENTS.PLAYER_LEFT]: (socket_id: string) => void;
	[SOCKET_EVENTS.GAME_LOOP]: (receivedRoomKey: string, player: Player) => void;
	[SOCKET_EVENTS.ERROR]: (message: string) => void;
	[SOCKET_EVENTS.RECEIVE_MESSAGE]: (message: string, username: string) => void;
	[SOCKET_EVENTS.RECEIVE_POSITION]: (
		position: number,
		userid: string,
		turnCount: number,
	) => void;
	[SOCKET_EVENTS.RECEIVE_MONEY]: (money: number, userid: string) => void;
	[SOCKET_EVENTS.AFTER_CHANGE_ROOM_STATUS]: () => void;
	[SOCKET_EVENTS.RECEIVE_TURN]: (turn: number) => void;
	[SOCKET_EVENTS.PROPERTY_BOUGHT]: (propertyId: number, userid: string) => void;
	[SOCKET_EVENTS.GET_DICE_ROLL]: (diceRoll: number) => void;
	[SOCKET_EVENTS.RECEIVE_VOTE]: (
		playerId: string,
		votes: number,
		voterId: string,
	) => void;
	[SOCKET_EVENTS.YOUR_VOTES]: (votedPlayerIds: string[]) => void;
	[SOCKET_EVENTS.PROPERTY_UPGRADED]: (
		propertyId: number,
		userid: string,
		rank: number,
	) => void;
	[SOCKET_EVENTS.RECEIVE_TRADE_OFFER]: (
		fromPlayer: string,
		toPlayer: string,
		tradeData: { offer: TradeData; request: TradeData },
	) => void;
	[SOCKET_EVENTS.RECEIVE_CONFIRM_TRADE_OFFER]: (
		fromPlayer: string,
		toPlayer: string,
		roomKey: string,
		tradeData: { offer: TradeData; request: TradeData },
		status: "accepted" | "rejected",
	) => void;
	[SOCKET_EVENTS.CHAT_HISTORY]: (
		messages: Array<{ message: string; username: string }>,
	) => void;
	[SOCKET_EVENTS.TIMER_TICK]: (remainingSeconds: number) => void;
	[SOCKET_EVENTS.TIMER_EXPIRED]: () => void;
	[SOCKET_EVENTS.ROOM_AUTO_DELETED]: (roomKey: string) => void;
	[SOCKET_EVENTS.INACTIVITY_WARNING]: (countdown: number) => void;
	[SOCKET_EVENTS.INACTIVITY_TICK]: (remainingSeconds: number) => void;
	[SOCKET_EVENTS.INACTIVITY_RESET]: () => void;
	connect: () => void;
	disconnect: (reason: string) => void;
	reconnect: () => void;
	reconnect_attempt: () => void;
	reconnect_failed: () => void;
	connect_error: (error: Error) => void;
}

// Events that the client emits to the server
export interface ClientToServerEvents {
	[SOCKET_EVENTS.CREATE_ROOM]: (
		options: z.infer<typeof createRoomSchema>,
		color: string,
		callback: (roomkey: string, playerList: Player[]) => void,
	) => void;
	[SOCKET_EVENTS.JOIN_ROOM]: (
		username: string,
		roomKey: string,
		color: string,
		password: string | undefined,
		callback: (username: string, playerList: Player[]) => void,
	) => void;
	[SOCKET_EVENTS.SEND_DICE_ROLL]: (diceRoll: number, roomKey: string) => void;
	[SOCKET_EVENTS.SEND_POSITION]: (position: number, roomKey: string) => void;
	[SOCKET_EVENTS.SEND_MESSAGE]: (message: string, roomKey: string) => void;
	[SOCKET_EVENTS.SEND_MONEY]: (
		amount: number,
		userid: string,
		roomKey: string,
	) => void;
	[SOCKET_EVENTS.JOIN_RANDOM_ROOM]: (
		color: string,
		callback: (roomKey: string, playerList: Player[]) => void,
	) => void;
	[SOCKET_EVENTS.CHANGE_ROOM_STATUS]: (
		roomKey: string,
		status: "waiting" | "playing" | "finished",
	) => void;
	[SOCKET_EVENTS.BUY_PROPERTY]: (
		propertyId: number,
		userId: string,
		roomkey: string,
	) => void;
	[SOCKET_EVENTS.SEND_VOTE]: (
		roomKey: string,
		playerId: string,
		votes: number,
	) => void;
	[SOCKET_EVENTS.SEND_TRADE_OFFER]: (
		fromPlayer: string,
		toPlayer: string,
		roomKey: string,
		tradeData: { offer: TradeData; request: TradeData },
	) => void;
	[SOCKET_EVENTS.UPGRADE_PROPERTY]: (
		propertyId: number,
		userId: string,
		roomKey: string,
		upgradeCost: number,
	) => void;
	[SOCKET_EVENTS.CONFIRM_TRADE_OFFER]: (
		fromPlayer: string,
		toPlayer: string,
		roomKey: string,
		tradeData: { offer: TradeData; request: TradeData },
		status: "accepted" | "rejected",
	) => void;
	[SOCKET_EVENTS.GO_TO_JAIL]: (userId: string, game_id: string) => void;
	[SOCKET_EVENTS.COLLECT_TAX]: (userId: string, game_id: string) => void;
	[SOCKET_EVENTS.LEAVE_ROOM]: (roomKey: string) => void;
	[SOCKET_EVENTS.SEND_TURN]: (turn: number, roomKey: string) => void;
	[SOCKET_EVENTS.LEAVE_GAME]: (userId: string, roomKey: string) => void;
	[SOCKET_EVENTS.REMOVE_PLAYER]: (roomKey: string) => void;
	[SOCKET_EVENTS.CONFIRM_ACTIVITY]: (roomKey: string) => void;
}
export interface InterServerEvents {
	ping: () => void;
}

export interface SocketData {
	name: string;
	roomKey: string;
	socketid: string;
	userid: string;
	dbRoomId: number;
	dbPlayerId: number;
	rank: number;
	position: number;
	money: number;
	color: string;
	properties: Property[];
	leader: boolean;
	skipTurn: boolean;
}
export type Player = {
	id: string;
	socketid: string;
	username: string;
	rank: number;
	position: number;
	money: number;
	color: string;
	votes: number;
	properties: Property[];
	leader: boolean;
	skipTurn: boolean;
};
export type Property = {
	id: number;
	rank: number;
};
export interface Room {
	roomKey: string;
	players: number;
	isPrivate: boolean;
	status: "waiting" | "playing" | "finished";
}
export interface TradeData {
	amount: number;
	properties: number[];
}
export interface RoomData {
	roomKey: string;
	name: string;
	isPrivate: boolean;
}

// ── Service result types ─────────────────────────────────────────

export type CreateRoomResult = {
	roomKey: string;
	roomId: number;
	player: {
		id: number;
		rank: number;
		position: number;
		money: number;
		leader: boolean;
		skipTurn: boolean;
	};
	players: PlayerSnapshot[];
	playerSnapshot: Player;
	currentTurn: number;
	votedPlayers: string[];
};

export type JoinRoomResult = {
	roomKey: string;
	roomId: number;
	player: {
		id: number;
		rank: number;
		position: number;
		money: number;
		leader: boolean;
		skipTurn: boolean;
	};
	players: PlayerSnapshot[];
	chatHistory: Array<{ message: string; username: string }>;
	currentTurn: number;
	votedPlayers: string[];
	playerSnapshot: Player;
};

export type TurnResult = { nextTurn: number };
export type PositionResult = { newPosition: number; userId: string };
export type MoneyResult = { newBalance: number; userId: string };
export type BuyPropertyResult = { propertyId: number; userId: string };
export type UpgradeResult = {
	propertyId: number;
	userId: string;
	newRank: number;
	newBalance: number;
} | null;
export type TradeConfirmResult = {
	fromPlayer: string;
	toPlayer: string;
	fromBalance: number;
	toBalance: number;
	accepted: boolean;
	tradeData: { offer: TradeData; request: TradeData };
	transferredProperties: Array<{ propertyId: number; toUserId: string }>;
};
export type VoteResult = {
	playerId: string;
	currentVotes: number;
	voterId: string;
};
export type ChangeStatusResult = {
	oldStatus: string;
	newStatus: string;
	timerAction: "start" | "stop" | "none";
};
export type LeaveResult = { userId: string; roomEmpty: boolean };

// Convenience aliases to avoid repeating the 4 generics everywhere
export type AppServer = Server<
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
>;
export type AppSocket = Socket<
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
>;
