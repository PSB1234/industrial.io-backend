import { createServer } from "node:http";
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import { initializeSocket } from "@/app/socket";
import { getAllWaitingRooms } from "@/db/queries/room";
import { connectRedis } from "@/db/redis";
import { env } from "@/env";

//create express app
const app: Express = express();
//middlewares
app.use(
	cors({
		origin: env.frontend_url,
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	}),
);
app.use(express.json());

// REST API routes for initial data fetching
app.get("/api/rooms", async (_req: Request, res: Response) => {
	try {
		const roomsData = await getAllWaitingRooms();
		res.json({ data: roomsData });
	} catch (error) {
		console.error("Error fetching rooms via REST:", error);
		res.status(500).json({ error: "Failed to fetch rooms" });
	}
});

//create http server
const httpServer = createServer(app);
const port = 8080;
//initialize socket
initializeSocket(httpServer);

// Connect to Redis and then start server
await connectRedis();

//start server
httpServer.listen(port, () => {
	console.log("listening on *:", port);
});
