import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";

if (!env.DATABASE_URL) {
	console.warn("DATABASE_URL is not set. Database queries will fail.");
}

const client = env.DATABASE_URL ? postgres(env.DATABASE_URL) : null;
export const db = client
	? drizzle(client)
	: (null as unknown as ReturnType<typeof drizzle>);
