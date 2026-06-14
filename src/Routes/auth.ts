import { Router } from "express";
import { auth, db } from "../firebase";
import {
	deleteUserProfile,
	getUserProfile,
	updateUserProfile,
	PROFILE_NOT_FOUND_CODE,
	USERNAME_TAKEN_CODE,
} from "../models/user";

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

/** Valid username format: 3-20 chars, letters, digits or underscore. */
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** Password rules: min 8 chars, at least one uppercase, one lowercase, one special character. */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;

function validatePassword(password: string): string | null {
	if (password.length < PASSWORD_MIN_LENGTH)
		return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
	if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
	if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
	if (!/[^a-zA-Z0-9]/.test(password)) return "Password must contain at least one special character";
	return null;
}

/**
 * Extracts the Firebase ID token from the `Authorization: Bearer <token>`
 * header, falling back to `idToken` in the request body.
 */
function extractIdToken(req: { headers: Record<string, any>; body?: any }): string | undefined {
	const authHeader = req.headers.authorization as string | undefined;
	const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
	return bearer || req.body?.idToken;
}

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
			return res.status(400).json({ error: "Missing fields" });
		}

		const passwordError = validatePassword(password);
		if (passwordError) {
			return res.status(400).json({ error: passwordError, code: "auth/weak-password" });
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
	const { idToken, username, name, lastName, avatarUrl } = req.body;

	if (!idToken || !username) {
		return res.status(400).json({ error: "Missing fields: idToken and username are required" });
	}

	if (!USERNAME_RE.test(username)) {
		return res.status(400).json({
			error: "Invalid username format (3-20 chars: letters, digits or underscore)",
			code: "auth/invalid-username",
		});
	}

	try {
		const decoded = await auth.verifyIdToken(idToken);
		const uid = decoded.uid;
		const lowerUsername = username.toLowerCase();

		const existing = await db.collection("users").doc(lowerUsername).get();
		if (existing.exists && existing.data()?.uid !== uid) {
			return res.status(400).json({
				error: "USERNAME_ALREADY_EXISTS",
				code: "auth/username-already-exists",
			});
		}

		// Google token carries the display name; use it as fallback when the
		// client does not send name/lastName explicitly.
		const resolvedName = (name as string | undefined)?.trim() || (decoded.name ?? "").split(" ")[0] || "";
		const resolvedLastName = (lastName as string | undefined)?.trim() || (decoded.name ?? "").split(" ").slice(1).join(" ") || "";

		const profileData = {
			uid,
			email: decoded.email ?? null,
			username: lowerUsername,
			name: resolvedName,
			lastName: resolvedLastName,
			displayName: `${resolvedName} ${resolvedLastName}`.trim() || decoded.name || lowerUsername,
			avatarUrl: (avatarUrl as string | undefined) ?? decoded.picture ?? null,
			provider: "google",
			profileComplete: true,
			createdAt: new Date(),
		};

		// Atomically: write users/{username}, create uids/{uid} lookup, remove
		// the temporary users/{uid} stub created by POST /auth/google.
		const batch = db.batch();
		batch.set(db.collection("users").doc(lowerUsername), profileData);
		batch.set(db.collection("uids").doc(uid), { username: lowerUsername });
		batch.delete(db.collection("users").doc(uid));
		await batch.commit();

		return res.json({ message: "Profile completed", username: lowerUsername });
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

/**
 * @openapi
 * /auth/profile:
 *   get:
 *     summary: Get the authenticated user's profile.
 *     description: >
 *       Resolves the username from the uids/{uid} reverse-lookup and returns the
 *       users/{username} document tied to the authenticated UID.
 *     tags:
 *       - auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Profile found.
 *       "400":
 *         description: Missing ID token.
 *       "401":
 *         description: Invalid or expired token.
 *       "404":
 *         description: No profile exists for the authenticated user.
 *       "500":
 *         description: Unexpected error.
 */
router.get("/profile", async (req, res) => {
	const idToken = extractIdToken(req);
	if (!idToken) {
		return res.status(400).json({ error: "Missing ID token", code: "auth/missing-id-token" });
	}

	let uid: string;
	try {
		uid = (await auth.verifyIdToken(idToken)).uid;
	} catch (error: any) {
		return res.status(401).json({
			error: error.message || "Invalid or expired session token",
			code: error.code || "auth/invalid-id-token",
		});
	}

	try {
		const profile = await getUserProfile(db, uid);
		return res.status(200).json({ profile });
	} catch (error: any) {
		if (error.code === PROFILE_NOT_FOUND_CODE) {
			return res.status(404).json({ error: error.message, code: error.code });
		}
		console.error(`[get-profile] Failed for uid=${uid}:`, error);
		return res.status(500).json({ error: error.message, code: error.code });
	}
});

/**
 * @openapi
 * /auth/profile:
 *   patch:
 *     summary: Update the authenticated user's profile.
 *     description: >
 *       Updates name, lastName, avatarUrl and/or username for the authenticated
 *       user. The username is re-validated transactionally: if the new value
 *       belongs to another account the write is rejected with
 *       `auth/username-already-exists`. Reusing the current username is allowed.
 *     tags:
 *       - auth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               lastName:
 *                 type: string
 *               username:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       "200":
 *         description: Profile updated.
 *       "400":
 *         description: Missing token, no fields, or invalid username format.
 *       "401":
 *         description: Invalid or expired token.
 *       "404":
 *         description: No profile exists for the authenticated user.
 *       "409":
 *         description: Username already in use by another account.
 *       "500":
 *         description: Unexpected error.
 */
router.patch("/profile", async (req, res) => {
	const idToken = extractIdToken(req);
	if (!idToken) {
		return res.status(400).json({ error: "Missing ID token", code: "auth/missing-id-token" });
	}

	let uid: string;
	try {
		uid = (await auth.verifyIdToken(idToken)).uid;
	} catch (error: any) {
		return res.status(401).json({
			error: error.message || "Invalid or expired session token",
			code: error.code || "auth/invalid-id-token",
		});
	}

	const { name, lastName, username, avatarUrl } = req.body ?? {};

	if (
		name === undefined &&
		lastName === undefined &&
		username === undefined &&
		avatarUrl === undefined
	) {
		return res.status(400).json({ error: "No fields to update", code: "profile/no-updates" });
	}

	if (username !== undefined && !USERNAME_RE.test(username)) {
		return res.status(400).json({
			error: "Invalid username format (3-20 chars: letters, digits or underscore)",
			code: "auth/invalid-username",
		});
	}

	try {
		const profile = await updateUserProfile(db, uid, { name, lastName, username, avatarUrl });
		console.log(`[update-profile] Profile updated for uid=${uid} (username=${profile.username})`);
		return res.status(200).json({ message: "Profile updated", profile });
	} catch (error: any) {
		if (error.code === USERNAME_TAKEN_CODE) {
			console.warn(
				`[update-profile] Username collision blocked for uid=${uid} ` + `(requested="${username}")`,
			);
			return res.status(409).json({ error: "Username already in use", code: USERNAME_TAKEN_CODE });
		}
		if (error.code === PROFILE_NOT_FOUND_CODE) {
			return res.status(404).json({ error: error.message, code: error.code });
		}
		console.error(`[update-profile] Failed for uid=${uid}:`, error);
		return res.status(500).json({ error: error.message, code: error.code });
	}
});

export default router;
