import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	cancelPendingDisconnect,
	schedulePendingDisconnect,
} from "@/lib/storage/disconnect_storage";

describe("disconnect_storage", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		// Clean up pending disconnects
		cancelPendingDisconnect("user1");
		cancelPendingDisconnect("user2");
		vi.useRealTimers();
	});

	// ── schedulePendingDisconnect ────────────────────────────

	describe("schedulePendingDisconnect", () => {
		it("calls callback after delay", () => {
			const callback = vi.fn();
			schedulePendingDisconnect("user1", callback, 3000);

			expect(callback).not.toHaveBeenCalled();
			vi.advanceTimersByTime(3000);
			expect(callback).toHaveBeenCalledOnce();
		});

		it("cancels previous pending for same user", () => {
			const firstCallback = vi.fn();
			const secondCallback = vi.fn();

			schedulePendingDisconnect("user1", firstCallback, 3000);
			schedulePendingDisconnect("user1", secondCallback, 3000);

			vi.advanceTimersByTime(3000);
			expect(firstCallback).not.toHaveBeenCalled();
			expect(secondCallback).toHaveBeenCalledOnce();
		});

		it("uses default delay when not specified", () => {
			const callback = vi.fn();
			schedulePendingDisconnect("user1", callback);

			vi.advanceTimersByTime(4999);
			expect(callback).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1);
			expect(callback).toHaveBeenCalledOnce();
		});
	});

	// ── cancelPendingDisconnect ──────────────────────────────

	describe("cancelPendingDisconnect", () => {
		it("returns true if pending existed", () => {
			schedulePendingDisconnect("user1", vi.fn(), 3000);
			expect(cancelPendingDisconnect("user1")).toBe(true);
		});

		it("returns false if nothing pending", () => {
			expect(cancelPendingDisconnect("unknown")).toBe(false);
		});

		it("prevents callback from firing", () => {
			const callback = vi.fn();
			schedulePendingDisconnect("user1", callback, 3000);
			cancelPendingDisconnect("user1");

			vi.advanceTimersByTime(5000);
			expect(callback).not.toHaveBeenCalled();
		});
	});
});
