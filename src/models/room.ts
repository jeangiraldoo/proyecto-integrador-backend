import { FieldValue } from "firebase-admin/firestore";

export interface Room {
	id: string;
	name: string;
	created_by: string;
	members: string[];
	created_at: FirebaseFirestore.Timestamp;
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
	const snapshot = await db.collection("rooms").where("created_by", "==", uid).get();
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Room);
}
