import { resetInactivityTimer } from "@/helper/inactivity_helpers";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import { sendMessage } from "@/service/chat.service";
import type { AppServer, AppSocket } from "@/types/type";
export function registerChatController(io: AppServer, socket: AppSocket) {
	socket.on(
		SOCKET_EVENTS.SEND_MESSAGE,
		async (message: string, roomKey: string) => {
			try {
				const result = await sendMessage({
					roomKey,
					userId: socket.data.userid,
					message,
				});

				io.to(result.roomKey).emit(
					SOCKET_EVENTS.RECEIVE_MESSAGE,
					result.message,
					result.playerName,
				);
				resetInactivityTimer(io, roomKey);
			} catch {
				socket.emit(SOCKET_EVENTS.ERROR, "Failed to send message");
			}
		},
	);
}
