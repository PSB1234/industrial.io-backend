const roomTimers = new Map<string, NodeJS.Timeout>();
const roomTimerStartTimes = new Map<string, number>();
const roomTickIntervals = new Map<string, NodeJS.Timeout>();

export const TIMER_DURATION_MS = 120000; // 2 minutes
export const TIMER_TICK_INTERVAL_MS = 1000; // 1 second

export const startRoomTimer = (roomKey: string): void => {
	// Clear any existing timer first
	stopRoomTimer(roomKey);

	const startTime = Date.now();
	roomTimerStartTimes.set(roomKey, startTime);
};

export const stopRoomTimer = (roomKey: string): void => {
	const timer = roomTimers.get(roomKey);
	if (timer) {
		clearTimeout(timer);
		roomTimers.delete(roomKey);
	}

	const tickInterval = roomTickIntervals.get(roomKey);
	if (tickInterval) {
		clearInterval(tickInterval);
		roomTickIntervals.delete(roomKey);
	}

	roomTimerStartTimes.delete(roomKey);
};

export const setRoomTimeout = (
	roomKey: string,
	timeout: NodeJS.Timeout,
): void => {
	roomTimers.set(roomKey, timeout);
};

export const setRoomTickInterval = (
	roomKey: string,
	interval: NodeJS.Timeout,
): void => {
	roomTickIntervals.set(roomKey, interval);
};

export const getRemainingTime = (roomKey: string): number => {
	const startTime = roomTimerStartTimes.get(roomKey);
	if (!startTime) return 0;

	const elapsed = Date.now() - startTime;
	const remaining = Math.max(0, TIMER_DURATION_MS - elapsed);
	return Math.ceil(remaining / 1000); // Return seconds
};

export const hasActiveTimer = (roomKey: string): boolean => {
	return roomTimerStartTimes.has(roomKey);
};

export const clearRoomTimer = (roomKey: string): void => {
	stopRoomTimer(roomKey);
};
