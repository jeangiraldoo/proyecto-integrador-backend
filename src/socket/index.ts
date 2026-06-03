import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

export function initSocket(httpServer: HttpServer): SocketServer {
	const io = new SocketServer(httpServer, {
		cors: {
			origin: CORS_ORIGIN,
			methods: ["GET", "POST"],
			credentials: true,
		},
	});

	io.on("connection", (socket) => {
		console.log(`Client connected: ${socket.id}`);

		socket.on("disconnect", () => {
			console.log(`Client disconnected: ${socket.id}`);
		});
	});

	return io;
}
