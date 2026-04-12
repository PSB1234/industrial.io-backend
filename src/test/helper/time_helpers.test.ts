import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db/queries/room", () => ({
    getRoomStatus: vi.fn(),
}));

vi.mock("@/lib/utils/room_cleanup", () => ({
    deleteRoom: vi.fn(),
}));

vi.mock("@/helper/room_utils", () => ({
    broadcastRoomList: vi.fn(),
}));

import { getRoomStatus } from "@/db/queries/room";
import { broadcastRoomList } from "@/helper/room_utils";
import { deleteRoom } from "@/lib/utils/room_cleanup";
import { handleTimerExpired } from "@/helper/time_helpers";

describe("time_helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("executes cleanup only once when timer expiry is triggered twice", async () => {
        (getRoomStatus as Mock).mockResolvedValue("waiting");

        const roomEmitter = { emit: vi.fn() };
        const io = {
            to: vi.fn().mockReturnValue(roomEmitter),
            emit: vi.fn(),
            of: vi.fn().mockReturnValue({ adapter: { rooms: new Map() } }),
            sockets: { sockets: new Map() },
        } as any;

        await Promise.all([
            handleTimerExpired(io, "123456"),
            handleTimerExpired(io, "123456"),
        ]);

        await new Promise<void>((resolve) => {
            setImmediate(() => resolve());
        });

        expect(getRoomStatus).toHaveBeenCalledTimes(1);
        expect(deleteRoom).toHaveBeenCalledTimes(1);
        expect(broadcastRoomList).toHaveBeenCalledTimes(1);
        expect(io.emit).toHaveBeenCalledTimes(1);
    });
});
