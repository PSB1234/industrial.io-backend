const inactivityTimers = new Map<string, NodeJS.Timeout>();
const warningTimers = new Map<string, NodeJS.Timeout>();
const warningTickIntervals = new Map<string, NodeJS.Timeout>();

export const INACTIVITY_DELAY_MS = 10 * 60 * 1000; // 10 minutes  before warning
export const WARNING_COUNTDOWN_MS = 60 * 1000; // 60 seconds to confirm

export const setInactivityTimer = (
	roomKey: string,
	timer: NodeJS.Timeout,
): void => {
	inactivityTimers.set(roomKey, timer);
};

export const clearInactivityTimer = (roomKey: string): void => {
	const timer = inactivityTimers.get(roomKey);
	if (timer) {
		clearTimeout(timer);
		inactivityTimers.delete(roomKey);
	}
};

export const setWarningTimer = (
	roomKey: string,
	timer: NodeJS.Timeout,
): void => {
	warningTimers.set(roomKey, timer);
};

export const clearWarningTimer = (roomKey: string): void => {
	const timer = warningTimers.get(roomKey);
	if (timer) {
		clearTimeout(timer);
		warningTimers.delete(roomKey);
	}
};

export const setWarningTickInterval = (
	roomKey: string,
	interval: NodeJS.Timeout,
): void => {
	warningTickIntervals.set(roomKey, interval);
};

export const clearWarningTickInterval = (roomKey: string): void => {
	const interval = warningTickIntervals.get(roomKey);
	if (interval) {
		clearInterval(interval);
		warningTickIntervals.delete(roomKey);
	}
};

export const clearAllInactivityState = (roomKey: string): void => {
	clearInactivityTimer(roomKey);
	clearWarningTimer(roomKey);
	clearWarningTickInterval(roomKey);
};

export const hasActiveInactivityTimer = (roomKey: string): boolean => {
	return inactivityTimers.has(roomKey);
};
