import type { RoomData } from "@/types/type";

export function joinRandomRoom(roomList: RoomData[]) {
	const roomKey = roomList.map(room => {
		return room.roomKey;
	});
	//Generate a random index
	const randomNumber = Math.floor(Math.random() * roomKey.length);
	//get Random Room
	const randomRoom = roomKey[randomNumber]!;
	return {
		randomRoomKey: randomRoom,
	};
}
