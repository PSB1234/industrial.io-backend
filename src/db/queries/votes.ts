import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { getPlayerRowId } from "@/db/queries/player";
import { kickVotes, players } from "@/db/schema";

// ── Kick Vote Queries ─────────────────────────────────────────────

export async function addVote(
	roomId: number,
	targetUserId: string,
	voterUserId: string,
): Promise<void> {
	if (targetUserId === voterUserId) {
		return;
	}

	const roomPlayers = await db
		.select({ id: players.id, userId: players.userId })
		.from(players)
		.where(
			and(
				eq(players.roomId, roomId),
				inArray(players.userId, [targetUserId, voterUserId]),
			),
		);

	const targetPlayer = roomPlayers.find(
		(player) => player.userId === targetUserId,
	);
	const voterPlayer = roomPlayers.find(
		(player) => player.userId === voterUserId,
	);
	if (!targetPlayer || !voterPlayer) {
		return;
	}

	await db
		.insert(kickVotes)
		.values({
			roomId,
			targetPlayerId: targetPlayer.id,
			voterId: voterPlayer.id,
		})
		.onConflictDoNothing();
}

export async function getVotes(
	roomId: number,
	targetUserId: string,
): Promise<number> {
	const targetPlayerId = await getPlayerRowId(roomId, targetUserId);
	if (targetPlayerId === null) {
		return 0;
	}

	const [result] = await db
		.select({ votes: count(kickVotes.id) })
		.from(kickVotes)
		.where(
			and(
				eq(kickVotes.roomId, roomId),
				eq(kickVotes.targetPlayerId, targetPlayerId),
			),
		);

	return Number(result?.votes ?? 0);
}

export async function getVotedPlayers(
	roomId: number,
	voterUserId: string,
): Promise<string[]> {
	const voterPlayerId = await getPlayerRowId(roomId, voterUserId);
	if (voterPlayerId === null) {
		return [];
	}

	const votes = await db
		.select({ targetPlayerId: kickVotes.targetPlayerId })
		.from(kickVotes)
		.where(
			and(eq(kickVotes.roomId, roomId), eq(kickVotes.voterId, voterPlayerId)),
		);

	if (votes.length === 0) {
		return [];
	}

	const targets = await db
		.select({ userId: players.userId })
		.from(players)
		.where(
			inArray(
				players.id,
				votes.map((vote) => vote.targetPlayerId),
			),
		);

	return targets.map((target) => target.userId);
}
