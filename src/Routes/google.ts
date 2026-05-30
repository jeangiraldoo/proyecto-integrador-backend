import { Router, Request, Response } from "express";
import { auth, db } from "../firebase";

const router = Router();

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
