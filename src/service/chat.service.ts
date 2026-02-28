import { addChatMessage } from "@/db/queries/chat";
import { getPlayer } from "@/db/queries/player";
import { resolveRoomId } from "@/helper/room_utils";

type SendMessageInput = {
	roomKey: string;
	userId: string;
	message: string;
};
export async function sendMessage(input: SendMessageInput) {
	const roomId = await resolveRoomId(input.roomKey);
	if (!roomId) throw new Error("Room not found");

	const player = await getPlayer(roomId, input.userId);
	if (!player) throw new Error("Player not found");

	await addChatMessage(roomId, player.id, input.message);

	return {
		roomKey: input.roomKey,
		message: input.message,
		playerName: player.username,
	};
}
