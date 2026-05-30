import { Router } from "express";
import { auth, db } from "../firebase";

const router = Router();
/**
 * @swagger
 * components:
 *   schemas:
 *     SignupRequest:
 *       type: object
 *       required:
 *         - name
 *         - lastName
 *         - username
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           example: Jean
 *         lastName:
 *           type: string
 *           example: Giraldo
 *         username:
 *           type: string
 *           example: jeang
 *         email:
 *           type: string
 *           format: email
 *           example: jean@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: MySecurePassword123
 *
 *     SignupSuccess:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: User created
 *         uid:
 *           type: string
 *           example: abc123xyz
 *
 *     CompleteProfileRequest:
 *       type: object
 *       required:
 *         - idToken
 *         - username
 *       properties:
 *         idToken:
 *           type: string
 *           description: Firebase ID token
 *         username:
 *           type: string
 *           example: jeang
 *
 *     MessageResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *         code:
 *           type: string
 */

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Create a new user account
 *     description: Creates a Firebase Authentication user and stores profile information in Firestore.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *     responses:
 *       201:
 *         description: User successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SignupSuccess'
 *       400:
 *         description: Missing fields or username already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 value:
 *                   error: Missing fields
 *               usernameExists:
 *                 value:
 *                   error: Username already in use
 *                   code: auth/username-already-exists
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/signup", async (req, res) => {
	try {
		const { name, lastName, username, email, password } = req.body;

		if (!(name && lastName && username && email && password)) {
			return res.status(400).json({
				error: "Missing fields",
			});
		}
		const snapshot = await db.collection("users").where("username", "==", username).limit(1).get();

		const usernameExists = !snapshot.empty;

		if (usernameExists) {
			return res.status(400).json({
				error: "Username already in use",
				code: "auth/username-already-exists",
			});
		}

		const userRecord = await auth.createUser({
			email,
			password,
		});

		await db.collection("users").doc(userRecord.uid).set({
			email,
			username,
			lastName,
			name,
			createdAt: new Date(),
		});

		return res.status(201).json({
			message: "User created",
			uid: userRecord.uid,
		});
	} catch (error: any) {
		return res.status(500).json({
			code: error.code,
			error: error.message,
		});
	}
});

router.post("/complete-profile", async (req, res) => {
	const { idToken, username } = req.body;

	try {
		const decoded = await auth.verifyIdToken(idToken);
		const uid = decoded.uid;

		const existing = await db.collection("users").where("username", "==", username).limit(1).get();

		if (!existing.empty) {
			return res.status(400).json({
				error: "USERNAME_ALREADY_EXISTS",
				code: "auth/username-already-exists",
			});
		}

		await db.collection("users").doc(uid).set(
			{
				username,
				profileComplete: true,
			},
			{ merge: true },
		);

		return res.json({
			message: "Profile completed",
		});
	} catch (error: any) {
		return res.status(401).json({
			error: error.code || error.message,
		});
	}
});

export default router;
