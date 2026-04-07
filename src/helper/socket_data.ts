import { getPlayerPropertiesWithRanks } from "@/db/queries/property";
import { getVotes } from "@/db/queries/votes";
import type { AppSocket, Player } from "@/types/type";

/** Copies player DB fields onto socket.data after a join or reconnect. */
export function hydrateSocketData(
	socket: AppSocket,
	roomKey: string,
	roomId: number,
	player: {
		id: number;
		rank: number;
		position: number;
		money: number;
		leader: boolean;
		skipTurn: boolean;
		behindBars?: boolean;
	},
	color: string,
): void {
	socket.data.roomKey = roomKey;
	socket.data.dbRoomId = roomId;
	socket.data.dbPlayerId = player.id;
	socket.data.rank = player.rank;
	socket.data.position = player.position;
	socket.data.money = player.money;
	socket.data.color = color;
	socket.data.leader = player.leader;
	socket.data.properties = [];
	socket.data.skipTurn = player.skipTurn;
	socket.data.behindBars = player.behindBars ?? false;
}

export function resetSocketRoomData(socket: AppSocket): void {
	socket.data.roomKey = "";
	socket.data.dbRoomId = 0;
	socket.data.dbPlayerId = 0;
	socket.data.behindBars = false;
}

/** Builds the Player object emitted via GAME_LOOP from current socket state. */
export async function buildPlayerSnapshot(
	socket: AppSocket,
	roomId: number,
): Promise<Player> {
	const [properties, votes] = await Promise.all([
		getPlayerPropertiesWithRanks(roomId, socket.data.userid),
		getVotes(roomId, socket.data.userid),
	]);

	return {
		id: socket.data.userid,
		username: socket.data.name,
		socketid: socket.data.socketid,
		rank: socket.data.rank,
		position: socket.data.position,
		money: socket.data.money,
		color: socket.data.color,
		votes,
		properties,
		leader: socket.data.leader,
		skipTurn: socket.data.skipTurn,
		behindBars: socket.data.behindBars,
	};
}
