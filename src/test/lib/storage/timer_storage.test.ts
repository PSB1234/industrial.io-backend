import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getRemainingTime,
	hasActiveTimer,
	startRoomTimer,
	stopRoomTimer,
	TIMER_DURATION_MS,
} from "@/lib/storage/timer_storage";

describe("timer_storage", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		// Clean up any timers between tests
		stopRoomTimer("room1");
		stopRoomTimer("room2");
		vi.useRealTimers();
	});

	// ── startRoomTimer ──────────────────────────────────────

	describe("startRoomTimer", () => {
		it("sets start time so timer becomes active", () => {
			startRoomTimer("room1");
			expect(hasActiveTimer("room1")).toBe(true);
		});

		it("clears previous timer if exists", () => {
			startRoomTimer("room1");
			vi.advanceTimersByTime(10_000);
			// Starting again should reset
			startRoomTimer("room1");
			// Remaining time should be full duration, not 110s
			expect(getRemainingTime("room1")).toBe(TIMER_DURATION_MS / 1000);
		});
	});

	// ── stopRoomTimer ───────────────────────────────────────

	describe("stopRoomTimer", () => {
		it("clears timer and start time", () => {
			startRoomTimer("room1");
			stopRoomTimer("room1");
			expect(hasActiveTimer("room1")).toBe(false);
		});

		it("is safe to call on non-existent room", () => {
			expect(() => stopRoomTimer("nonexistent")).not.toThrow();
		});
	});

	// ── getRemainingTime ────────────────────────────────────

	describe("getRemainingTime", () => {
		it("returns full duration seconds at start", () => {
			startRoomTimer("room1");
			expect(getRemainingTime("room1")).toBe(TIMER_DURATION_MS / 1000);
		});

		it("returns correct seconds after time passes", () => {
			startRoomTimer("room1");
			vi.advanceTimersByTime(30_000); // 30 seconds
			expect(getRemainingTime("room1")).toBe(90);
		});

		it("returns 0 after full duration", () => {
			startRoomTimer("room1");
			vi.advanceTimersByTime(TIMER_DURATION_MS + 1000);
			expect(getRemainingTime("room1")).toBe(0);
		});

		it("returns 0 if no timer set", () => {
			expect(getRemainingTime("nonexistent")).toBe(0);
		});
	});

	// ── hasActiveTimer ──────────────────────────────────────

	describe("hasActiveTimer", () => {
		it("true after start", () => {
			startRoomTimer("room1");
			expect(hasActiveTimer("room1")).toBe(true);
		});

		it("false after stop", () => {
			startRoomTimer("room1");
			stopRoomTimer("room1");
			expect(hasActiveTimer("room1")).toBe(false);
		});

		it("false for unknown room", () => {
			expect(hasActiveTimer("unknown")).toBe(false);
		});
	});
});
