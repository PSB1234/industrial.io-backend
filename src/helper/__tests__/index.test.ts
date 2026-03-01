import { expect, test, vi } from "vitest";

vi.mock("@/db/queries/room", () => ({
	getRoomByKey: vi.fn().mockResolvedValue(null),
}));

import { generateRoomId } from "../index";

test("generateRoomId returns a 6 digit string", async () => {
	const id = await generateRoomId();
	expect(id).toMatch(/^\d{6}$/);
});
