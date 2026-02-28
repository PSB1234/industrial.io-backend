import { addPlayerMoney, deductPlayerMoney } from "@/db/queries/player";
import {
	assignProperty,
	getPropertyRank,
	removeProperty,
} from "@/db/queries/property";

/** Moves properties between players, preserving ranks. Returns list of transferred properties. */
export async function transferProperties(
	roomId: number,
	fromUserId: string,
	toUserId: string,
	propertyIds: number[],
): Promise<Array<{ propertyId: number; toUserId: string }>> {
	const transferred: Array<{ propertyId: number; toUserId: string }> = [];
	for (const propertyId of propertyIds) {
		const rank = await getPropertyRank(roomId, fromUserId, propertyId);
		await removeProperty(roomId, fromUserId, propertyId);
		await assignProperty(roomId, toUserId, propertyId, rank);
		transferred.push({ propertyId, toUserId });
	}
	return transferred;
}

export async function transferMoney(
	roomId: number,
	fromUserId: string,
	toUserId: string,
	amount: number,
): Promise<void> {
	if (amount === 0) return;
	await deductPlayerMoney(roomId, fromUserId, amount);
	await addPlayerMoney(roomId, toUserId, amount);
}
