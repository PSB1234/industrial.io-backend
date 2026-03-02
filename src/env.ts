import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		frontend_url: z.string().url().optional().default("http://localhost:3000"),
		DATABASE_URL: z.string().url().optional(),
		REDIS_URL: z.string().url().default("redis://localhost:6379"),
	},
	runtimeEnv: {
		frontend_url: process.env.frontend_url,
		DATABASE_URL: process.env.DATABASE_URL,
		REDIS_URL: process.env.REDIS_URL,
	},
	emptyStringAsUndefined: true,
});
