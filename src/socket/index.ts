import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../firebase";
import { getRoomById, RoomNotFoundError } from "../models/room";

/**
 * Shape of a chat message broadcast to clients in a room.
 * Field names use snake_case to match the Firestore `messages` model.
 */
interface ChatMessage {
	id: string;
	room_id: string;
	sender_id: string;
	username: string;
	text: string;
	timestamp: string;
}

interface ServerToClientEvents {
	receive_message: (message: ChatMessage) => void;
	error: (payload: { message: string }) => void;
	room_joined: (payload: { roomId: string; isAdmin: boolean }) => void;
}

interface ClientToServerEvents {
	join_room: (roomId: string) => void;
	leave_room: (roomId: string) => void;
	send_message: (payload: { room_id: string; text: string }) => void;
}

interface SocketData {
	uid: string;
	username: string;
}

/** Maximum length accepted for a single chat message. */
const MAX_MESSAGE_LENGTH = 2000;

export function initSocket(httpServer: HttpServer, allowedOrigins: string[]): SocketServer {
	const io = new SocketServer<
		ClientToServerEvents,
		ServerToClientEvents,
		Record<string, never>,
		SocketData
	>(httpServer, {
		cors: {
			origin: allowedOrigins,
			methods: ["GET", "POST"],
			credentials: true,
		},
	});

	// Handshake auth: every socket must present a valid Firebase ID token.
	io.use(async (socket, next) => {
		const token = socket.handshake.auth?.token as string | undefined;
		if (!token) return next(new Error("Missing auth token"));
		try {
			const decoded = await auth.verifyIdToken(token);
			// uids/{uid} is the reverse-lookup collection (uid → username)
			const uidDoc = await db.collection("uids").doc(decoded.uid).get();
			if (!uidDoc.exists) return next(new Error("User not found"));
			socket.data.uid = decoded.uid;
			socket.data.username = uidDoc.data()?.username;
			next();
		} catch {
			next(new Error("Invalid or expired token"));
		}
	});

	io.on("connection", (socket) => {
		console.log(`[socket] connected ${socket.id} (uid=${socket.data.uid})`);

		// --- join_room: validate room exists, subscribe socket, and emit role flag ---
		socket.on("join_room", async (roomId) => {
			if (typeof roomId !== "string" || !roomId.trim()) {
				socket.emit("error", { message: "join_room requires a valid roomId" });
				return;
			}
			try {
				const { isAdmin } = await getRoomById(db, roomId, socket.data.uid);
				socket.join(roomId);
				socket.emit("room_joined", { roomId, isAdmin });
				console.log(
					`[socket] ${socket.data.username} joined room ${roomId} (isAdmin=${isAdmin})`,
				);
			} catch (error) {
				if (error instanceof RoomNotFoundError) {
					socket.emit("error", { message: error.message });
				} else {
					console.error(`[socket] failed to validate room ${roomId}:`, error);
					socket.emit("error", { message: "Failed to join room" });
				}
			}
		});

		// --- leave_room: unsubscribe this socket from a room channel ---
		socket.on("leave_room", (roomId) => {
			if (typeof roomId === "string" && roomId.trim()) {
				socket.leave(roomId);
				console.log(`[socket] ${socket.data.username} (${socket.id}) left room ${roomId}`);
			}
		});

		// --- send_message: validate, persist, and broadcast to the room only ---
		socket.on("send_message", async (payload) => {
			const roomId = typeof payload?.room_id === "string" ? payload.room_id.trim() : "";
			const text = typeof payload?.text === "string" ? payload.text.trim() : "";

			// Validate the payload before touching Firestore or broadcasting.
			if (!roomId || !text) {
				console.warn(
					`[socket] rejected send_message from uid=${socket.data.uid}: missing room_id or text`,
				);
				socket.emit("error", { message: "Message must include room_id and non-empty text" });
				return;
			}
			if (text.length > MAX_MESSAGE_LENGTH) {
				socket.emit("error", { message: "Message is too long" });
				return;
			}

			// Identity is server-authoritative — never trusted from the client.
			try {
				const docRef = await db.collection("rooms").doc(roomId).collection("messages").add({
					room_id: roomId,
					sender_id: socket.data.uid,
					username: socket.data.username,
					text,
					// Firebase SERVER timestamp (BE-15): authoritative time that keeps the
					// chat history in a consistent chronological order across time zones.
					timestamp: FieldValue.serverTimestamp(),
				});

				const message: ChatMessage = {
					id: docRef.id,
					room_id: roomId,
					sender_id: socket.data.uid,
					username: socket.data.username,
					text,
					// Live broadcast uses the send time for instant display; the persisted
					// serverTimestamp above is the source of truth for history ordering.
					timestamp: new Date().toISOString(),
				};

				// Strict room isolation: only sockets joined to roomId receive this.
				io.to(roomId).emit("receive_message", message);
				console.log(
					`[socket] receive_message -> room ${roomId} (id=${docRef.id}, from=${socket.data.username})`,
				);
			} catch (error) {
				console.error(`[socket] failed to persist message in room ${roomId}:`, error);
				socket.emit("error", { message: "Failed to send message" });
			}
		});

		socket.on("disconnect", () => {
			console.log(`[socket] disconnected ${socket.id}`);
		});
	});

	return io;
}
