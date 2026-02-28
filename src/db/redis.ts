import { createClient } from "redis";
import { env } from "@/env";

export const redis = createClient({
	url: env.REDIS_URL,
});

redis.on("error", (err) => {
	console.error("Redis Client Error", err);
});

export async function connectRedis() {
	if (!redis.isOpen) {
		await redis.connect();
		console.log("Connected to Redis");
	}
}

/**
 * Retrieves and parses a JSON value from Redis.
 */
export async function getCache<T>(key: string): Promise<T | null> {
	if (!redis.isOpen) return null;
	try {
		const data = await redis.get(key);
		if (!data) return null;
		return JSON.parse(data) as T;
	} catch (error) {
		console.error(`Redis Get Error [${key}]:`, error);
		return null;
	}
}

/**
 * Sets a JSON value in Redis with an optional TTL (in seconds).
 */
export async function setCache<T>(
	key: string,
	value: T,
	ttlSeconds?: number,
): Promise<void> {
	if (!redis.isOpen) return;
	try {
		const data = JSON.stringify(value);
		if (ttlSeconds) {
			await redis.setEx(key, ttlSeconds, data);
		} else {
			await redis.set(key, data);
		}
	} catch (error) {
		console.error(`Redis Set Error [${key}]:`, error);
	}
}

/**
 * Deletes a key from Redis.
 */
export async function delCache(key: string): Promise<void> {
	if (!redis.isOpen) return;
	try {
		await redis.del(key);
	} catch (error) {
		console.error(`Redis Del Error [${key}]:`, error);
	}
}
