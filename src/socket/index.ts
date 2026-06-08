import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../firebase";

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

interface ServerToClientEvents {
	"new-message": (message: {
		id: string;
		room_id: string;
		sender_id: string;
		username: string;
		text: string;
		timestamp: string;
	}) => void;
	error: (payload: { message: string }) => void;
}

interface ClientToServerEvents {
	"join-room": (roomId: string) => void;
	"leave-room": (roomId: string) => void;
	"send-message": (payload: { roomId: string; text: string }) => void;
}

interface SocketData {
	uid: string;
	username: string;
}

export function initSocket(httpServer: HttpServer): SocketServer {
	const io = new SocketServer<
		ClientToServerEvents,
		ServerToClientEvents,
		Record<string, never>,
		SocketData
	>(httpServer, {
		cors: {
			origin: CORS_ORIGIN,
			methods: ["GET", "POST"],
			credentials: true,
		},
	});

	io.use(async (socket, next) => {
		const token = socket.handshake.auth?.token as string | undefined;
		if (!token) return next(new Error("Missing auth token"));
		try {
			const decoded = await auth.verifyIdToken(token);
			const userDoc = await db.collection("users").doc(decoded.uid).get();
			if (!userDoc.exists) return next(new Error("User not found"));
			socket.data.uid = decoded.uid;
			socket.data.username = userDoc.data()?.username;
			next();
		} catch {
			next(new Error("Invalid or expired token"));
		}
	});

	io.on("connection", (socket) => {
		console.log(`Client connected: ${socket.id} (uid: ${socket.data.uid})`);

		socket.on("join-room", (roomId: string) => {
			socket.join(roomId);
		});

		socket.on("leave-room", (roomId: string) => {
			socket.leave(roomId);
		});

		socket.on("send-message", async (payload: { roomId: string; text: string }) => {
			const { roomId, text } = payload;
			if (!roomId || !text) return;

			try {
				const docRef = await db.collection("rooms").doc(roomId).collection("messages").add({
					room_id: roomId,
					sender_id: socket.data.uid,
					username: socket.data.username,
					text,
					timestamp: FieldValue.serverTimestamp(),
				});

				io.to(roomId).emit("new-message", {
					id: docRef.id,
					room_id: roomId,
					sender_id: socket.data.uid,
					username: socket.data.username,
					text,
					timestamp: new Date().toISOString(),
				});
			} catch (error) {
				console.error("Error saving message:", error);
				socket.emit("error", { message: "Failed to save message" });
			}
		});

		socket.on("disconnect", () => {
			console.log(`Client disconnected: ${socket.id}`);
		});
	});

	return io;
}
