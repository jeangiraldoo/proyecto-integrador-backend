import { Router, Request, Response } from "express";
import { auth, db } from "../firebase";

const router = Router();
/**
 * @swagger
 * components:
 *   schemas:
 *     GoogleAuthRequest:
 *       type: object
 *       required:
 *         - idToken
 *       properties:
 *         idToken:
 *           type: string
 *           description: Firebase ID token obtained after Google Sign-In
 *
 *     GoogleAuthSuccess:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Authenticated
 *         uid:
 *           type: string
 *           example: abc123xyz
 *         user:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               format: email
 *             provider:
 *               type: string
 *               example: google
 *             username:
 *               type: string
 *               nullable: true
 *             profileComplete:
 *               type: boolean
 *             createdAt:
 *               type: string
 *               format: date-time
 */

/**
 * @swagger
 * /auth/google:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Authenticate with Google
 *     description: |
 *       Verifies a Firebase ID token obtained through Google Sign-In.
 *
 *       - Creates a Firestore user document on first login.
 *       - Requires the user to complete their profile by choosing a username.
 *       - Returns authenticated user information once the profile is complete.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GoogleAuthRequest'
 *     responses:
 *       200:
 *         description: User authenticated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GoogleAuthSuccess'
 *       403:
 *         description: User must choose a username before continuing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               firstLogin:
 *                 summary: First Google login
 *                 value:
 *                   error: FIRST_LOGIN_USERNAME_REQUIRED
 *                   code: google/username-required
 *               profileIncomplete:
 *                 summary: Existing user without completed profile
 *                 value:
 *                   error: PROFILE_INCOMPLETE_USERNAME_REQUIRED
 *                   code: google/username-required
 *       401:
 *         description: Invalid or expired Firebase ID token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/google", async (req: Request, res: Response): Promise<any> => {
	const { idToken } = req.body;

	try {
		const decoded = await auth.verifyIdToken(idToken);
		const uid = decoded.uid;

		const userRef = db.collection("users").doc(uid);
		const userSnap = await userRef.get();

		if (!userSnap.exists) {
			await userRef.set({
				email: decoded.email,
				provider: "google",
				createdAt: new Date(),
				profileComplete: false,
				username: null,
			});

			return res.status(403).json({
				error: "FIRST_LOGIN_USERNAME_REQUIRED",
				code: "google/username-required",
			});
		}

		const userData = userSnap.data();

		if (!userData?.profileComplete || !userData?.username) {
			return res.status(403).json({
				error: "PROFILE_INCOMPLETE_USERNAME_REQUIRED",
				code: "google/username-required",
			});
		}

		return res.json({
			message: "Authenticated",
			uid,
			user: userData,
		});
	} catch (error: any) {
		return res.status(401).json({
			error: error.code || error.message,
		});
	}
});

export default router;
