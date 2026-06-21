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

interface Participant {
	uid: string;
	username: string;
	avatarUrl: string | null;
}

interface ServerToClientEvents {
	/**
	 * Emitted after a successful `join_room`.
	 * Includes the list of participants already in the room at the time of joining.
	 * @param payload.roomId       The room the socket joined.
	 * @param payload.isAdmin      `true` if the connected user is the room creator (host).
	 * @param payload.participants Users already connected to the room at join time.
	 */
	room_joined: (payload: { roomId: string; isAdmin: boolean; participants: Participant[] }) => void;

	/**
	 * Broadcast to all other sockets in a room when a new participant joins.
	 * @param payload.roomId    The room that was joined.
	 * @param payload.uid       UID of the user who joined.
	 * @param payload.username  Display name of the user who joined.
	 * @param payload.avatarUrl Profile picture URL, or null if the user has no avatar.
	 */
	participant_joined: (payload: {
		roomId: string;
		uid: string;
		username: string;
		avatarUrl: string | null;
	}) => void;

	/**
	 * Broadcast to all remaining sockets in a room when a participant leaves or disconnects.
	 * @param payload.roomId    The room that was left.
	 * @param payload.uid       UID of the user who left.
	 * @param payload.username  Display name of the user who left.
	 * @param payload.avatarUrl Profile picture URL, or null if the user has no avatar.
	 */
	participant_left: (payload: {
		roomId: string;
		uid: string;
		username: string;
		avatarUrl: string | null;
	}) => void;

	/**
	 * Delivers a new chat message to every socket currently in the room.
	 * @param message Full message object including server-assigned `id` and ISO timestamp.
	 */
	receive_message: (message: ChatMessage) => void;

	/**
	 * Sent to the originating socket when any operation fails.
	 * @param payload.message Human-readable description of the error.
	 */
	error: (payload: { message: string }) => void;
}

interface ClientToServerEvents {
	/**
	 * Subscribe this socket to a room channel.
	 * Validates room existence in Firestore and emits `room_joined` on success.
	 * @param roomId Firestore document ID of the target room (e.g. "ABC-1234").
	 */
	join_room: (roomId: string) => void;

	/**
	 * Unsubscribe this socket from a room channel.
	 * @param roomId Firestore document ID of the room to leave.
	 */
	leave_room: (roomId: string) => void;

	/**
	 * Send a chat message to a room.
	 * The server persists the message in Firestore and broadcasts it via `receive_message`.
	 * @param payload.room_id Target room ID.
	 * @param payload.text    Message text (max 2 000 characters).
	 */
	send_message: (payload: { room_id: string; text: string }) => void;
}

interface SocketData {
	uid: string;
	username: string;
	avatarUrl: string | null;
}

/** Maximum length accepted for a single chat message. */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * In-memory set of UIDs that currently have an active socket connection.
 * Prevents the same user from opening a second concurrent socket.
 */
const connectedUids = new Set<string>();

/** Returns the list of authenticated participants currently joined to a room. */
function getRoomParticipants(io: SocketServer, roomId: string): Participant[] {
	const socketIds = io.sockets.adapter.rooms.get(roomId) ?? new Set<string>();
	const participants: Participant[] = [];
	for (const socketId of socketIds) {
		const s = io.sockets.sockets.get(socketId);
		if (s?.data.uid)
			participants.push({
				uid: s.data.uid,
				username: s.data.username,
				avatarUrl: s.data.avatarUrl,
			});
	}
	return participants;
}

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
			if (connectedUids.has(decoded.uid)) {
				return next(new Error("User already connected"));
			}
			// uids/{uid} is the reverse-lookup collection (uid → username)
			const uidDoc = await db.collection("uids").doc(decoded.uid).get();
			if (!uidDoc.exists) return next(new Error("User not found"));
			const username = uidDoc.data()?.username as string;
			const userDoc = await db.collection("users").doc(username).get();
			socket.data.uid = decoded.uid;
			socket.data.username = username;
			socket.data.avatarUrl = (userDoc.data()?.avatarUrl as string | undefined) ?? null;
			next();
		} catch {
			next(new Error("Invalid or expired token"));
		}
	});

	io.on("connection", (socket) => {
		connectedUids.add(socket.data.uid);
		console.log(`[socket] connected ${socket.id} (uid=${socket.data.uid})`);

		// --- join_room: validate room exists, subscribe socket, and emit role flag ---
		socket.on("join_room", async (roomId) => {
			if (typeof roomId !== "string" || !roomId.trim()) {
				socket.emit("error", { message: "join_room requires a valid roomId" });
				return;
			}
			try {
				const { isAdmin } = await getRoomById(db, roomId, socket.data.uid);
				// Snapshot participants BEFORE joining so the list sent to the newcomer
				// does not include themselves.
				const participants = getRoomParticipants(io, roomId);
				socket.join(roomId);
				socket.emit("room_joined", { roomId, isAdmin, participants });
				// Notify everyone already in the room that a new participant arrived.
				socket.to(roomId).emit("participant_joined", {
					roomId,
					uid: socket.data.uid,
					username: socket.data.username,
					avatarUrl: socket.data.avatarUrl,
				});
				console.log(`[socket] ${socket.data.username} joined room ${roomId} (isAdmin=${isAdmin})`);
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
				socket.to(roomId).emit("participant_left", {
					roomId,
					uid: socket.data.uid,
					username: socket.data.username,
					avatarUrl: socket.data.avatarUrl,
				});
				console.log(`[socket] ${socket.data.username} (${socket.id}) left room ${roomId}`);
			}
		});

		// --- send_message: validate, persist, and broadcast to the room only ---
		socket.on("send_message", async (payload) => {
			const roomId = typeof payload?.room_id === "string" ? payload.room_id.trim() : "";
			const text = typeof payload?.text === "string" ? payload.text.trim() : "";

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
					// Firebase SERVER timestamp: authoritative time for consistent history ordering.
					timestamp: FieldValue.serverTimestamp(),
				});

				const message: ChatMessage = {
					id: docRef.id,
					room_id: roomId,
					sender_id: socket.data.uid,
					username: socket.data.username,
					text,
					// Live broadcast uses client time for instant display; serverTimestamp is source of
					// truth for history ordering.
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

		// disconnecting fires before the socket leaves its rooms, so socket.rooms is still populated.
		socket.on("disconnecting", () => {
			for (const roomId of socket.rooms) {
				if (roomId === socket.id) continue; // skip the socket's own private room
				socket.to(roomId).emit("participant_left", {
					roomId,
					uid: socket.data.uid,
					username: socket.data.username,
					avatarUrl: socket.data.avatarUrl,
				});
			}
		});

		socket.on("disconnect", () => {
			connectedUids.delete(socket.data.uid);
			console.log(`[socket] disconnected ${socket.id} (uid=${socket.data.uid})`);
		});
	});

	return io;
}
