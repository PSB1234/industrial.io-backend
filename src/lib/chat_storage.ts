export interface Message {
	message: string;
	username: string;
}

const chatHistory = new Map<string, Message[]>();

export const getRoomMessages = (roomKey: string): Message[] => {
	return chatHistory.get(roomKey) || [];
};

export const addRoomMessage = (roomKey: string, message: Message) => {
	const messages = chatHistory.get(roomKey) || [];
	messages.push(message);
	// Keep only last 50 messages to prevent memory issues
	if (messages.length > 50) {
		messages.shift();
	}
	chatHistory.set(roomKey, messages);
};

export const clearRoomMessages = (roomKey: string) => {
	chatHistory.delete(roomKey);
};
