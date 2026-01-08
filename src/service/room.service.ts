export function joinRandomRoom(roomList: string[]) {
	//Generate a random index
	const randomNumber = Math.floor(Math.random() * roomList.length);
	//get Random Room
	const randomRoomKey = roomList[randomNumber]!;
	return {
		randomRoomKey,
	};
}
