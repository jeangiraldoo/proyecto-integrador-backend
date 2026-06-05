import { Router, Request, Response } from "express";
import { auth, db } from "../firebase";
import { createRoom, getRoomsByUser } from "../models/room";

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

export default router;
