import { deleteRoomByKey } from "@/db/queries/room";
import { clearAllInactivityState } from "@/lib/storage/inactivity_storage";
import { clearRoomTimer } from "@/lib/storage/timer_storage";

export async function deleteRoom(roomKey: string): Promise<void> {
	// Timers are runtime-only and are still in-memory.
	clearRoomTimer(roomKey);
	clearAllInactivityState(roomKey);
	await deleteRoomByKey(roomKey);

	console.log(`Room ${roomKey} fully deleted from database`);
}
