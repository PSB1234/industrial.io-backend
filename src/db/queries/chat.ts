// ── Chat Queries ──────────────────────────────────────────────────

import { asc, eq } from "drizzle-orm";
import { db } from "..";
import { chatMessages, players } from "../schema";

export async function addChatMessage(
	roomId: number,
	playerId: number,
	message: string,
): Promise<void> {
	await db.insert(chatMessages).values({ roomId, playerId, message });
}

export async function getRoomMessages(
	roomId: number,
): Promise<Array<{ message: string; username: string }>> {
	return db
		.select({ message: chatMessages.message, username: players.username })
		.from(chatMessages)
		.innerJoin(players, eq(chatMessages.playerId, players.id))
		.where(eq(chatMessages.roomId, roomId))
		.orderBy(asc(chatMessages.createdAt))
		.limit(50);
}

export async function clearRoomMessages(roomId: number): Promise<void> {
	await db.delete(chatMessages).where(eq(chatMessages.roomId, roomId));
}
