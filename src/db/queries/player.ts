import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { delCache, getCache, setCache } from "@/db/redis";
import { kickVotes, players, properties, rooms } from "@/db/schema";
import { DEFAULT_STARTING_MONEY } from "@/helper/default_value";
import type { PlayerSnapshot } from "@/types/type";

export async function getPlayerRowId(
	roomId: number,
	userId: string,
): Promise<number | null> {
	const [player] = await db
		.select({ id: players.id })
		.from(players)
		.where(and(eq(players.roomId, roomId), eq(players.userId, userId)))
		.limit(1);

	return player?.id ?? null;
}

export async function createPlayer(
	roomId: number,
	userId: string,
	socketId: string,
	username: string,
	color: string,
	isLeader: boolean,
	money: number = DEFAULT_STARTING_MONEY,
): Promise<{
	id: number;
	rank: number;
	position: number;
	money: number;
	leader: boolean;
	behindBars: boolean;
}> {
	const existing = await getPlayer(roomId, userId);
	if (existing) {
		await db
			.update(players)
			.set({
				socketId,
				username,
				color,
				isLeader: existing.leader || isLeader,
			})
			.where(eq(players.id, existing.id));

		await delCache(`room:players:${roomId}`);

		return {
			id: existing.id,
			rank: existing.rank,
			position: existing.position,
			money: existing.money,
			leader: existing.leader || isLeader,
			behindBars: existing.behindBars,
		};
	}

	const [roomRow] = await db
		.update(rooms)
		.set({ rankSequence: sql`${rooms.rankSequence} + 1` })
		.where(eq(rooms.id, roomId))
		.returning({ rankSequence: rooms.rankSequence });

	if (!roomRow) {
		throw new Error(`Room ${roomId} not found while creating player`);
	}

	const [player] = await db
		.insert(players)
		.values({
			roomId,
			userId,
			socketId,
			username,
			money,
			color,
			rank: roomRow.rankSequence,
			isLeader,
		})
		.returning({
			id: players.id,
			rank: players.rank,
			position: players.position,
			money: players.money,
			leader: players.isLeader,
			behindBars: players.behindBars,
		});

	if (!player) {
		throw new Error("Failed to create player");
	}

	await delCache(`room:players:${roomId}`);

	return player;
}

export async function getPlayer(
	roomId: number,
	userId: string,
): Promise<{
	id: number;
	userId: string;
	socketId: string;
	username: string;
	rank: number;
	position: number;
	money: number;
	color: string;
	leader: boolean;
	behindBars: boolean;
} | null> {
	const [player] = await db
		.select({
			id: players.id,
			userId: players.userId,
			socketId: players.socketId,
			username: players.username,
			rank: players.rank,
			position: players.position,
			money: players.money,
			color: players.color,
			leader: players.isLeader,
			behindBars: players.behindBars,
		})
		.from(players)
		.where(and(eq(players.roomId, roomId), eq(players.userId, userId)))
		.limit(1);

	return player ?? null;
}

export async function getPlayersInRoom(
	roomId: number,
): Promise<PlayerSnapshot[]> {
	const cacheKey = `room:players:${roomId}`;
	const cachedPlayers = await getCache<PlayerSnapshot[]>(cacheKey);
	if (cachedPlayers) return cachedPlayers;

	const [playerRows, propertyRows, voteRows] = await Promise.all([
		db
			.select({
				dbId: players.id,
				id: players.userId,
				socketid: players.socketId,
				username: players.username,
				rank: players.rank,
				position: players.position,
				money: players.money,
				color: players.color,
				leader: players.isLeader,
				behindBars: players.behindBars,
			})
			.from(players)
			.where(eq(players.roomId, roomId))
			.orderBy(asc(players.rank)),
		db
			.select({
				playerId: properties.playerId,
				id: properties.propertyId,
				rank: properties.rank,
			})
			.from(properties)
			.where(eq(properties.roomId, roomId)),
		db
			.select({
				targetPlayerId: kickVotes.targetPlayerId,
				votes: count(kickVotes.id),
			})
			.from(kickVotes)
			.where(eq(kickVotes.roomId, roomId))
			.groupBy(kickVotes.targetPlayerId),
	]);

	const propertiesByPlayer = new Map<number, { id: number; rank: number }[]>();
	for (const property of propertyRows) {
		const existing = propertiesByPlayer.get(property.playerId) ?? [];
		existing.push({ id: property.id, rank: property.rank });
		propertiesByPlayer.set(property.playerId, existing);
	}

	const votesByPlayer = new Map<number, number>();
	for (const vote of voteRows) {
		votesByPlayer.set(vote.targetPlayerId, Number(vote.votes));
	}

	const result = playerRows.map((player) => ({
		id: player.id,
		socketid: player.socketid,
		username: player.username,
		rank: player.rank,
		position: player.position,
		money: player.money,
		color: player.color,
		leader: player.leader,
		behindBars: player.behindBars,
		properties: propertiesByPlayer.get(player.dbId) ?? [],
		votes: votesByPlayer.get(player.dbId) ?? 0,
	}));

	await setCache(cacheKey, result, 3600); // cache for 1 hr (deleted on mutations)
	return result;
}

export async function getPlayerCountInRoom(roomId: number): Promise<number> {
	const [result] = await db
		.select({ count: count(players.id) })
		.from(players)
		.where(eq(players.roomId, roomId));

	return Number(result?.count ?? 0);
}

export async function updatePlayerMoney(
	roomId: number,
	userId: string,
	money: number,
): Promise<void> {
	await db
		.update(players)
		.set({ money })
		.where(and(eq(players.roomId, roomId), eq(players.userId, userId)));
	await delCache(`room:players:${roomId}`);
}

export async function addPlayerMoney(
	roomId: number,
	userId: string,
	amount: number,
): Promise<void> {
	await db
		.update(players)
		.set({ money: sql`${players.money} + ${amount}` })
		.where(and(eq(players.roomId, roomId), eq(players.userId, userId)));
	await delCache(`room:players:${roomId}`);
}

export async function deductPlayerMoney(
	roomId: number,
	userId: string,
	amount: number,
): Promise<void> {
	await db
		.update(players)
		.set({ money: sql`${players.money} - ${amount}` })
		.where(and(eq(players.roomId, roomId), eq(players.userId, userId)));
	await delCache(`room:players:${roomId}`);
}

export async function getPlayerMoney(
	roomId: number,
	userId: string,
): Promise<number> {
	const [result] = await db
		.select({ money: players.money })
		.from(players)
		.where(and(eq(players.roomId, roomId), eq(players.userId, userId)))
		.limit(1);

	return result?.money ?? 0;
}

export async function updatePlayerPosition(
	roomId: number,
	userId: string,
	position: number,
): Promise<void> {
	await db
		.update(players)
		.set({ position })
		.where(and(eq(players.roomId, roomId), eq(players.userId, userId)));
	await delCache(`room:players:${roomId}`);
}
export async function jailPlayer(
	roomId: number,
	userId: string,
): Promise<void> {
	await db
		.update(players)
		.set({ behindBars: true })
		.where(and(eq(players.roomId, roomId), eq(players.userId, userId)));
	await delCache(`room:players:${roomId}`);
}
export async function freeJailedPlayer(
	roomId: number,
	userId: string,
): Promise<void> {
	await db
		.update(players)
		.set({ behindBars: false })
		.where(and(eq(players.roomId, roomId), eq(players.userId, userId)));
	await delCache(`room:players:${roomId}`);
}
export async function deletePlayer(
	roomId: number,
	userId: string,
): Promise<void> {
	await db
		.delete(players)
		.where(and(eq(players.roomId, roomId), eq(players.userId, userId)));
	await delCache(`room:players:${roomId}`);
}
