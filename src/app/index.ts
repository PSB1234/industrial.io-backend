import { createServer } from "node:http";
import cors from "cors";
import express, { type Express } from "express";
import { initializeSocket } from "@/app/socket";

//create express app
const app: Express = express();
//middlewares
app.use(
	cors({
		origin: "http://localhost:3000",
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	}),
);
app.use(express.json());
//routes
//create http server
const httpServer = createServer(app);
const port = 8080;
//initialize socket
initializeSocket(httpServer);
//start server
httpServer.listen(port, () => {
	console.log("listening on *:", port);
});
