import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		frontend_url: z.url(),
		DATABASE_URL: z.url(),
		REDIS_URL: z.url(),
	},
	runtimeEnv: {
		frontend_url: process.env.frontend_url,
		DATABASE_URL: process.env.DATABASE_URL,
		REDIS_URL: process.env.REDIS_URL,
	},
	emptyStringAsUndefined: true,
});
