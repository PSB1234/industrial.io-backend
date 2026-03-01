import { beforeEach, describe, expect, it } from "vitest";
import {
	handleConnection,
	handleDisconnection,
	isUserConnected,
} from "../index";

// The `users` Map is module-level state. We clean it by disconnecting all
// users before each test so there's no bleed between tests.

function fullyDisconnect(userId: string) {
	while (isUserConnected(userId)) {
		handleDisconnection(userId);
	}
}

describe("connection tracking", () => {
	const userId = "test-user-1";

	beforeEach(() => {
		fullyDisconnect(userId);
		fullyDisconnect("test-user-2");
	});

	// ── handleConnection ──────────────────────────────────────

	describe("handleConnection", () => {
		it("returns true on first connect (new user)", () => {
			expect(handleConnection(userId)).toBe(true);
		});

		it("returns false on subsequent connects (extra tab)", () => {
			handleConnection(userId);
			expect(handleConnection(userId)).toBe(false);
		});

		it("increments internal count", () => {
			handleConnection(userId);
			handleConnection(userId);
			// Two connections, first disconnect should return false (still has 1 tab)
			expect(handleDisconnection(userId)).toBe(false);
			// Second disconnect drops to 0 → true
			expect(handleDisconnection(userId)).toBe(true);
		});
	});

	// ── handleDisconnection ───────────────────────────────────

	describe("handleDisconnection", () => {
		it("returns true when fully disconnected (count reaches 0)", () => {
			handleConnection(userId);
			expect(handleDisconnection(userId)).toBe(true);
		});

		it("returns false when tabs remain", () => {
			handleConnection(userId);
			handleConnection(userId);
			expect(handleDisconnection(userId)).toBe(false);
		});
	});

	// ── isUserConnected ───────────────────────────────────────

	describe("isUserConnected", () => {
		it("true after connect", () => {
			handleConnection(userId);
			expect(isUserConnected(userId)).toBe(true);
		});

		it("false after full disconnect", () => {
			handleConnection(userId);
			handleDisconnection(userId);
			expect(isUserConnected(userId)).toBe(false);
		});

		it("false for never-connected user", () => {
			expect(isUserConnected("unknown-user")).toBe(false);
		});
	});
});
