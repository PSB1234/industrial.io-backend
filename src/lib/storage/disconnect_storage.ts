const pendingDisconnects = new Map<string, NodeJS.Timeout>();

const DISCONNECT_GRACE_MS = 5 * 1000; //5 sec

export function schedulePendingDisconnect(
	userId: string,
	callback: () => void,
	delayMs = DISCONNECT_GRACE_MS,
): void {
	cancelPendingDisconnect(userId);

	const timer = setTimeout(() => {
		pendingDisconnects.delete(userId);
		callback();
	}, delayMs);

	pendingDisconnects.set(userId, timer);
}

export function cancelPendingDisconnect(userId: string): boolean {
	const timer = pendingDisconnects.get(userId);
	if (timer) {
		clearTimeout(timer);
		pendingDisconnects.delete(userId);
		return true;
	}
	return false;
}
