import { FieldValue } from "firebase-admin/firestore";

export interface Room {
	id: string;
	name: string;
	created_by: string;
	members: string[];
	created_at: FirebaseFirestore.Timestamp;
}

export class RoomNotFoundError extends Error {
	constructor(roomId: string) {
		super(`Room '${roomId}' not found`);
		this.name = "RoomNotFoundError";
	}
}

export class ForbiddenError extends Error {
	constructor(action: string) {
		super(`Forbidden: only the room creator can ${action}`);
		this.name = "ForbiddenError";
	}
}

export async function getRoomById(
	db: FirebaseFirestore.Firestore,
	roomId: string,
	uid: string,
): Promise<{ room: Room; isAdmin: boolean }> {
	const doc = await db.collection("rooms").doc(roomId).get();
	if (!doc.exists) throw new RoomNotFoundError(roomId);
	const room = { id: doc.id, ...doc.data() } as Room;
	return { room, isAdmin: room.created_by === uid };
}

// Messages live as a subcollection: /rooms/{roomId}/messages/{messageId}
export interface Message {
	id: string;
	room_id: string;
	sender_id: string;
	username: string;
	text: string;
	timestamp: FirebaseFirestore.Timestamp;
}

const ROOM_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROOM_CODE_DIGITS = "0123456789";

function generateRoomCode(): string {
	const letters = Array.from(
		{ length: 3 },
		() => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)],
	).join("");
	const digits = Array.from(
		{ length: 4 },
		() => ROOM_CODE_DIGITS[Math.floor(Math.random() * ROOM_CODE_DIGITS.length)],
	).join("");
	return `${letters}-${digits}`;
}

export async function createRoom(
	db: FirebaseFirestore.Firestore,
	uid: string,
	name: string,
): Promise<{ id: string; name: string; created_by: string; members: string[] }> {
	const MAX_ATTEMPTS = 5;
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const code = generateRoomCode();
		const docRef = db.collection("rooms").doc(code);
		const existing = await docRef.get();
		if (!existing.exists) {
			await docRef.set({
				name,
				created_by: uid,
				members: [],
				created_at: FieldValue.serverTimestamp(),
			});
			return { id: code, name, created_by: uid, members: [] };
		}
	}
	throw new Error("Failed to generate a unique room code after maximum attempts");
}

export async function getRoomsByUser(
	db: FirebaseFirestore.Firestore,
	uid: string,
): Promise<Room[]> {
	// Composite index on (created_by, created_at) required in Firestore Console
	const snapshot = await db
		.collection("rooms")
		.where("created_by", "==", uid)
		.orderBy("created_at", "desc")
		.get();
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Room);
}

const DELETE_BATCH_SIZE = 500;

export async function updateRoomName(
	db: FirebaseFirestore.Firestore,
	roomId: string,
	uid: string,
	newName: string,
): Promise<void> {
	const docRef = db.collection("rooms").doc(roomId);
	const snap = await docRef.get();
	if (!snap.exists) throw new RoomNotFoundError(roomId);
	if (snap.data()?.created_by !== uid) throw new ForbiddenError("rename this room");
	await docRef.update({ name: newName });
}

export async function deleteRoom(
	db: FirebaseFirestore.Firestore,
	roomId: string,
	uid: string,
): Promise<void> {
	const docRef = db.collection("rooms").doc(roomId);
	const snap = await docRef.get();
	if (!snap.exists) throw new RoomNotFoundError(roomId);
	if (snap.data()?.created_by !== uid) throw new ForbiddenError("delete this room");

	// Delete messages subcollection in batches to avoid orphaned reads.
	const messagesRef = docRef.collection("messages");
	let chunk = await messagesRef.limit(DELETE_BATCH_SIZE).get();
	while (!chunk.empty) {
		const batch = db.batch();
		chunk.docs.forEach((d) => batch.delete(d.ref));
		await batch.commit();
		chunk = await messagesRef.limit(DELETE_BATCH_SIZE).get();
	}

	await docRef.delete();
}

/**
 * A chat message as returned to clients: the Firestore Timestamp is serialized
 * to an ISO-8601 string so it travels cleanly over JSON.
 */
export interface ChatHistoryMessage {
	id: string;
	room_id: string;
	sender_id: string;
	username: string;
	text: string;
	timestamp: string | null;
}

/**
 * Retrieves the full chat history of a room, ordered chronologically ascending
 * (oldest → newest) by the server `timestamp`, ready to render in the UI (US-11).
 *
 * Reads strictly the `messages` subcollection of the given room, so messages
 * from other rooms are never included.
 *
 * @async
 * @function getRoomMessages
 * @param {FirebaseFirestore.Firestore} db - The Firestore (admin) database instance.
 * @param {string} roomId - The room whose history is requested.
 * @returns {Promise<ChatHistoryMessage[]>} Messages in ascending chronological order.
 */
export async function getRoomMessages(
	db: FirebaseFirestore.Firestore,
	roomId: string,
): Promise<ChatHistoryMessage[]> {
	const snapshot = await db
		.collection("rooms")
		.doc(roomId)
		.collection("messages")
		.orderBy("timestamp", "asc")
		.get();

	return snapshot.docs.map((doc) => {
		const data = doc.data();
		const ts = data.timestamp as FirebaseFirestore.Timestamp | undefined;
		return {
			id: doc.id,
			room_id: (data.room_id as string | undefined) ?? roomId,
			sender_id: (data.sender_id as string | undefined) ?? "",
			username: (data.username as string | undefined) ?? "",
			text: (data.text as string | undefined) ?? "",
			timestamp: ts?.toDate ? ts.toDate().toISOString() : null,
		};
	});
}
