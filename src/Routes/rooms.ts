import { Router, Request, Response } from "express";
import { AccessToken } from "livekit-server-sdk";
import { auth, db } from "../firebase";
import {
	createRoom,
	getRoomById,
	getRoomsByUser,
	getRoomMessages,
	updateRoomName,
	deleteRoom,
	RoomNotFoundError,
	ForbiddenError,
} from "../models/room";

const router = Router();

async function requireAuth(req: Request, res: Response): Promise<string | null> {
	const header = req.headers.authorization;
	if (!header?.startsWith("Bearer ")) {
		res.status(401).json({ error: "Missing authorization token" });
		return null;
	}
	try {
		const decoded = await auth.verifyIdToken(header.slice(7));
		return decoded.uid;
	} catch {
		res.status(401).json({ error: "Invalid or expired token" });
		return null;
	}
}

/**
 * @swagger
 * /rooms:
 *   post:
 *     tags:
 *       - Rooms
 *     summary: Create a study room
 *     description: Creates a new room in Firestore. The authenticated user becomes the creator.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Sala de Cálculo
 *     responses:
 *       201:
 *         description: Room created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 created_by:
 *                   type: string
 *                 members:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Missing field name
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/", async (req, res) => {
	const uid = await requireAuth(req, res);
	if (!uid) return;

	const { name } = req.body;
	if (!name) {
		return res.status(400).json({ error: "Missing field: name" });
	}

	try {
		const room = await createRoom(db, uid, name);
		return res.status(201).json(room);
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

/**
 * @swagger
 * /rooms:
 *   get:
 *     tags:
 *       - Rooms
 *     summary: Get rooms created by the authenticated user
 *     description: Returns only the rooms where created_by matches the authenticated user's UID.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   created_by:
 *                     type: string
 *                   members:
 *                     type: array
 *                     items:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", async (req, res) => {
	const uid = await requireAuth(req, res);
	if (!uid) return;

	try {
		const rooms = await getRoomsByUser(db, uid);
		return res.json(rooms);
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

/**
 * @swagger
 * /rooms/{roomId}/messages:
 *   get:
 *     tags:
 *       - Rooms
 *     summary: Get the chat history of a room
 *     description: >
 *       Returns the room's messages ordered chronologically ascending
 *       (oldest first) by the server timestamp, ready to render in the chat panel.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the room whose history is requested.
 *     responses:
 *       200:
 *         description: Chat history (ascending by timestamp)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   room_id:
 *                     type: string
 *                   sender_id:
 *                     type: string
 *                   username:
 *                     type: string
 *                   text:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/:roomId/messages", async (req, res) => {
	const uid = await requireAuth(req, res);
	if (!uid) return;

	const { roomId } = req.params;
	try {
		const messages = await getRoomMessages(db, roomId);
		return res.json(messages);
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

/**
 * @swagger
 * /rooms/{roomId}:
 *   patch:
 *     tags:
 *       - Rooms
 *     summary: Rename a study room
 *     description: >
 *       Updates the `name` field of a room. Only the room creator is allowed to
 *       rename it. Returns 403 if the authenticated user is not the creator.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the room to rename.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Sala de Álgebra Lineal
 *     responses:
 *       200:
 *         description: Room renamed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *       400:
 *         description: Missing or empty field name
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — caller is not the room creator
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:roomId", async (req, res) => {
	const uid = await requireAuth(req, res);
	if (!uid) return;

	const { roomId } = req.params;
	const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
	if (!name) return res.status(400).json({ error: "Missing or empty field: name" });

	try {
		await updateRoomName(db, roomId, uid, name);
		return res.json({ id: roomId, name });
	} catch (error) {
		if (error instanceof RoomNotFoundError)
			return res.status(404).json({ error: (error as Error).message });
		if (error instanceof ForbiddenError)
			return res.status(403).json({ error: (error as Error).message });
		return res.status(500).json({ error: (error as Error).message });
	}
});

/**
 * @swagger
 * /rooms/{roomId}:
 *   delete:
 *     tags:
 *       - Rooms
 *     summary: Permanently delete a study room
 *     description: >
 *       Deletes the room document and all messages in its subcollection. Only
 *       the room creator is allowed to delete it. Returns 403 otherwise.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the room to delete.
 *     responses:
 *       204:
 *         description: Room deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — caller is not the room creator
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:roomId", async (req, res) => {
	const uid = await requireAuth(req, res);
	if (!uid) return;

	const { roomId } = req.params;

	try {
		await deleteRoom(db, roomId, uid);
		return res.status(204).send();
	} catch (error) {
		if (error instanceof RoomNotFoundError)
			return res.status(404).json({ error: (error as Error).message });
		if (error instanceof ForbiddenError)
			return res.status(403).json({ error: (error as Error).message });
		return res.status(500).json({ error: (error as Error).message });
	}
});

/**
 * @swagger
 * /rooms/{roomId}/token:
 *   get:
 *     tags:
 *       - Rooms
 *     summary: Generate a LiveKit access token for a room
 *     description: >
 *       Issues a signed JWT that grants the authenticated user permission to join
 *       the LiveKit room whose name matches the Firestore room ID.
 *       The frontend uses this token to connect directly to the LiveKit server.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Firestore room ID (used as the LiveKit room name).
 *     responses:
 *       200:
 *         description: LiveKit access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Signed JWT to pass to the LiveKit client SDK.
 *                 url:
 *                   type: string
 *                   description: LiveKit server WebSocket URL.
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 *       503:
 *         description: LiveKit not configured on the server
 */
router.get("/:roomId/token", async (req, res) => {
	const uid = await requireAuth(req, res);
	if (!uid) return;

	const { roomId } = req.params;

	try {
		await getRoomById(db, roomId, uid);
	} catch (error) {
		if (error instanceof RoomNotFoundError)
			return res.status(404).json({ error: "Room not found" });
		return res.status(500).json({ error: (error as Error).message });
	}

	const livekitUrl = process.env.LIVEKIT_URL;
	const apiKey = process.env.LIVEKIT_API_KEY;
	const apiSecret = process.env.LIVEKIT_API_SECRET;

	if (!livekitUrl || !apiKey || !apiSecret) {
		return res.status(503).json({ error: "LiveKit not configured" });
	}

	const uidDoc = await db.collection("uids").doc(uid).get();
	const username = (uidDoc.data()?.username as string | undefined) ?? uid;

	const at = new AccessToken(apiKey, apiSecret, { identity: uid, name: username });
	at.addGrant({ roomJoin: true, room: roomId });

	return res.json({ token: await at.toJwt(), url: livekitUrl });
});

export default router;
