import { and, eq } from "drizzle-orm";
import { db } from "..";
import { roomAccess } from "../schema";

export async function hasRoomAccess(
	roomId: number,
	userId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: roomAccess.id })
		.from(roomAccess)
		.where(and(eq(roomAccess.roomId, roomId), eq(roomAccess.userId, userId)))
		.limit(1);
	return !!row;
}

export async function grantRoomAccess(
	roomId: number,
	userId: string,
): Promise<void> {
	await db
		.insert(roomAccess)
		.values({ roomId, userId })
		.onConflictDoNothing();
}
