// ── Room Queries ──────────────────────────────────────────────────

import { asc, eq } from "drizzle-orm";
import { db } from "..";
import { delCache, getCache, setCache } from "../redis";
import { rooms } from "../schema";

const WAITING_ROOMS_CACHE_KEY = "rooms:waiting:all";

export async function createRoom(
	roomKey: string,
	name: string,
	type: "public" | "private",
	password?: string,
): Promise<number> {
	const [room] = await db
		.insert(rooms)
		.values({ roomKey, name, type, password })
		.returning({ id: rooms.id });

	if (!room) {
		throw new Error("Failed to create room");
	}

	await delCache(WAITING_ROOMS_CACHE_KEY);
	return room.id;
}

export async function getRoomByKey(roomKey: string) {
	const cacheKey = `room:key:${roomKey}`;
	const cachedRoom = await getCache<typeof room>(cacheKey);
	if (cachedRoom) return cachedRoom;

	const [room] = await db
		.select()
		.from(rooms)
		.where(eq(rooms.roomKey, roomKey))
		.limit(1);

	if (room) {
		await setCache(cacheKey, room, 3600); // Cache for 1 hour
	}

	return room ?? null;
}

export async function getRoomStatus(
	roomKey: string,
): Promise<"waiting" | "playing" | "finished" | null> {
	const [room] = await db
		.select({ status: rooms.status })
		.from(rooms)
		.where(eq(rooms.roomKey, roomKey))
		.limit(1);

	return room?.status ?? null;
}

export async function setRoomStatus(
	roomKey: string,
	status: "waiting" | "playing" | "finished",
): Promise<void> {
	await db.update(rooms).set({ status }).where(eq(rooms.roomKey, roomKey));
	await delCache(`room:key:${roomKey}`);
	await delCache(WAITING_ROOMS_CACHE_KEY);
}

export async function deleteRoomByKey(roomKey: string): Promise<void> {
	await db.delete(rooms).where(eq(rooms.roomKey, roomKey));
	await delCache(`room:key:${roomKey}`);
	await delCache(WAITING_ROOMS_CACHE_KEY);
}

export async function getAllWaitingRooms(): Promise<
	{
		roomKey: string;
		name: string;
	}[]
> {
	const cachedRooms = await getCache<
		{
			roomKey: string;
			name: string;
		}[]
	>(WAITING_ROOMS_CACHE_KEY);

	if (cachedRooms) return cachedRooms;

	const waitingRooms = await db
		.select({ roomKey: rooms.roomKey, name: rooms.name })
		.from(rooms)
		.where(eq(rooms.status, "waiting"))
		.orderBy(asc(rooms.createdAt));

	await setCache(WAITING_ROOMS_CACHE_KEY, waitingRooms, 30); // Cache waiting rooms for 30s
	return waitingRooms;
}

export async function getCurrentTurn(roomKey: string): Promise<number> {
	// Active games query turn frequently, hit Redis first.
	const cacheKey = `room:turn:${roomKey}`;
	const cachedTurn = await getCache<number>(cacheKey);
	if (cachedTurn !== null) {
		return cachedTurn;
	}

	const [room] = await db
		.select({ currentTurn: rooms.currentTurn })
		.from(rooms)
		.where(eq(rooms.roomKey, roomKey))
		.limit(1);

	const turn = room?.currentTurn ?? 1;
	await setCache(cacheKey, turn, 3600); // cache for 1 hr
	return turn;
}

export async function setCurrentTurn(
	roomKey: string,
	turn: number,
): Promise<void> {
	const cacheKey = `room:turn:${roomKey}`;

	// Update Redis instantly (sub 1ms)
	await setCache(cacheKey, turn, 3600);

	// Persist to DB asynchronously
	await db
		.update(rooms)
		.set({ currentTurn: turn })
		.where(eq(rooms.roomKey, roomKey));

	await delCache(`room:key:${roomKey}`);
}
