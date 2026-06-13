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

export async function createRoom(
	db: FirebaseFirestore.Firestore,
	uid: string,
	name: string,
): Promise<{ id: string; name: string; created_by: string; members: string[] }> {
	const docRef = await db.collection("rooms").add({
		name,
		created_by: uid,
		members: [],
		created_at: FieldValue.serverTimestamp(),
	});
	return { id: docRef.id, name, created_by: uid, members: [] };
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
