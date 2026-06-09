import { Router } from "express";
import { auth, db } from "../firebase";
import { deleteUserProfile } from "../models/user";

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
 * Maximum age (in seconds) allowed for the user's last sign-in before a
 * sensitive operation (account deletion) requires re-authentication.
 * Mirrors Firebase Auth's native `auth/requires-recent-login` window (~5 min).
 */
const RECENT_LOGIN_MAX_AGE_SECONDS = 5 * 60;

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

		// Profiles are keyed by lowercase username (users/{username}); the frontend
		// looks them up there and maps uid -> username via the uids/{uid} doc.
		const lowerUsername = username.toLowerCase();

		const existing = await db.collection("users").doc(lowerUsername).get();
		if (existing.exists) {
			return res.status(400).json({
				error: "Username already in use",
				code: "auth/username-already-exists",
			});
		}

		const userRecord = await auth.createUser({
			email,
			password,
		});

		// Write the public profile and the reverse lookup atomically.
		const batch = db.batch();
		batch.set(db.collection("users").doc(lowerUsername), {
			uid: userRecord.uid,
			email,
			username: lowerUsername,
			name,
			lastName,
			displayName: `${name} ${lastName}`.trim(),
			provider: "password",
			profileComplete: true,
			createdAt: new Date(),
		});
		batch.set(db.collection("uids").doc(userRecord.uid), {
			username: lowerUsername,
		});
		await batch.commit();

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

/**
 * @openapi
 * /auth/account:
 *   delete:
 *     summary: Permanently delete the authenticated user's account.
 *     description: >
 *       Verifies the caller's Firebase ID token and enforces a recent-login
 *       window. If the session is too old it aborts and returns
 *       `auth/requires-recent-login` (before touching any data, to avoid
 *       inconsistent states). Otherwise it deletes the user's Firestore profile
 *       documents and then the Firebase Auth identity. This is a hard delete
 *       (no soft delete).
 *     tags:
 *       - auth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: >
 *                   Firebase ID token. Optional alternative to the
 *                   `Authorization: Bearer <idToken>` header.
 *     responses:
 *       "200":
 *         description: Account deleted permanently.
 *       "400":
 *         description: Missing ID token.
 *       "401":
 *         description: >
 *           Invalid/expired token, or re-authentication required
 *           (`auth/requires-recent-login`).
 *       "500":
 *         description: Unexpected error while deleting the account.
 */
router.delete("/account", async (req, res) => {
	const authHeader = req.headers.authorization;
	const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
	const idToken: string | undefined = bearer || req.body?.idToken;

	if (!idToken) {
		return res.status(400).json({
			error: "Missing ID token",
			code: "auth/missing-id-token",
		});
	}

	// --- Step 1: Verify identity and enforce the re-authentication policy ---
	let uid: string;
	try {
		// checkRevoked = true rejects tokens from revoked or disabled sessions.
		const decoded = await auth.verifyIdToken(idToken, true);
		uid = decoded.uid;

		const nowSeconds = Math.floor(Date.now() / 1000);
		const sessionAgeSeconds = nowSeconds - decoded.auth_time;

		if (sessionAgeSeconds > RECENT_LOGIN_MAX_AGE_SECONDS) {
			// Replicate Firebase Auth's native `auth/requires-recent-login`.
			// The flow is aborted BEFORE deleting anything in Firestore to avoid
			// an inconsistent state (profile gone but Auth account still active).
			console.warn(
				`[delete-account] Re-authentication required for uid=${uid} ` +
					`(last sign-in ${sessionAgeSeconds}s ago > ${RECENT_LOGIN_MAX_AGE_SECONDS}s limit)`,
			);
			return res.status(401).json({
				error:
					"Recent authentication is required to delete your account. Please log in again and retry.",
				code: "auth/requires-recent-login",
			});
		}
	} catch (error: any) {
		return res.status(401).json({
			error: error.message || "Invalid or expired session token",
			code: error.code || "auth/invalid-id-token",
		});
	}

	// --- Step 2: Purge data sequentially: Firestore first, then Firebase Auth ---
	try {
		const result = await deleteUserProfile(db, uid);
		console.log(
			`[delete-account] Firestore profile purged for uid=${uid} ` +
				`(username=${result.username ?? "n/a"}, docs=[${result.deletedPaths.join(", ")}])`,
		);

		await auth.deleteUser(uid);
		console.log(`[delete-account] Firebase Auth identity deleted for uid=${uid}`);

		return res.status(200).json({
			message: "Account deleted permanently",
			uid,
			deleted: result,
		});
	} catch (error: any) {
		console.error(`[delete-account] Failed to delete account uid=${uid}:`, error);
		return res.status(500).json({
			error: error.message || "Failed to delete the account",
			code: error.code || "account/deletion-failed",
		});
	}
});

export default router;
