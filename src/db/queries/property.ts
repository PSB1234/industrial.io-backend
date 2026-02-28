// ── Property Queries ──────────────────────────────────────────────

import { and, eq } from "drizzle-orm";
import { db } from "..";
import { properties } from "../schema";
import { getPlayerRowId } from "./player";

export async function assignProperty(
	roomId: number,
	userId: string,
	propertyId: number,
	rank = 0,
): Promise<void> {
	const playerId = await getPlayerRowId(roomId, userId);
	if (playerId === null) {
		return;
	}

	await db
		.insert(properties)
		.values({ roomId, playerId, propertyId, rank })
		.onConflictDoUpdate({
			target: [properties.roomId, properties.propertyId],
			set: { playerId, rank },
		});
}

export async function getPlayerProperties(
	roomId: number,
	userId: string,
): Promise<Set<number>> {
	const props = await getPlayerPropertiesWithRanks(roomId, userId);
	return new Set(props.map((property) => property.id));
}

export async function getPlayerPropertiesWithRanks(
	roomId: number,
	userId: string,
): Promise<{ id: number; rank: number }[]> {
	const playerId = await getPlayerRowId(roomId, userId);
	if (playerId === null) {
		return [];
	}

	return db
		.select({ id: properties.propertyId, rank: properties.rank })
		.from(properties)
		.where(
			and(eq(properties.roomId, roomId), eq(properties.playerId, playerId)),
		);
}

export async function getPropertyRank(
	roomId: number,
	userId: string,
	propertyId: number,
): Promise<number> {
	const playerId = await getPlayerRowId(roomId, userId);
	if (playerId === null) {
		return 0;
	}

	const [property] = await db
		.select({ rank: properties.rank })
		.from(properties)
		.where(
			and(
				eq(properties.roomId, roomId),
				eq(properties.playerId, playerId),
				eq(properties.propertyId, propertyId),
			),
		)
		.limit(1);

	return property?.rank ?? 0;
}

export async function removeProperty(
	roomId: number,
	userId: string,
	propertyId: number,
): Promise<void> {
	const playerId = await getPlayerRowId(roomId, userId);
	if (playerId === null) {
		return;
	}

	await db
		.delete(properties)
		.where(
			and(
				eq(properties.roomId, roomId),
				eq(properties.playerId, playerId),
				eq(properties.propertyId, propertyId),
			),
		);
}

export async function removeAllPlayerProperties(
	roomId: number,
	userId: string,
): Promise<void> {
	const playerId = await getPlayerRowId(roomId, userId);
	if (playerId === null) {
		return;
	}

	await db.delete(properties).where(eq(properties.playerId, playerId));
}
