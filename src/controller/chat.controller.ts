import type { Server, Socket } from "socket.io";
import { addRoomMessage } from "@/lib/chat_storage";
import { SOCKET_EVENTS } from "@/lib/socket_events";
import type {
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
} from "@/types/type";

export function registerChatController(
	io: Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>,
	socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) {
	socket.on(SOCKET_EVENTS.SEND_MESSAGE, (message: string, roomKey: string) => {
		// Save message to history
		addRoomMessage(roomKey, { message, username: socket.data.name });
		io.to(roomKey).emit(
			SOCKET_EVENTS.RECEIVE_MESSAGE,
			message,
			socket.data.name,
		);
	});
}
