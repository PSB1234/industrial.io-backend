import { z } from "zod";

const createRoomSchema = z.object({
	roomName: z.string().min(3).max(20),
	type: z.enum(["public", "private"]),
	password: z.string().min(4).max(20).optional(),
});
export { createRoomSchema };
