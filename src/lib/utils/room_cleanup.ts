import { deleteRoomByKey } from "@/db/queries/room";
import { clearRoomTimer } from "@/lib/storage/timer_storage";

export async function deleteRoom(roomKey: string): Promise<void> {
	// Timers are runtime-only and are still in-memory.
	clearRoomTimer(roomKey);
	await deleteRoomByKey(roomKey);

	console.log(`Room ${roomKey} fully deleted from database`);
}
