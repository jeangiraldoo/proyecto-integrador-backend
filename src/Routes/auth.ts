import { Router } from "express";
import { auth, db } from "../firebase";

const router = Router();

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
