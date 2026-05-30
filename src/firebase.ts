import admin from "firebase-admin";
import { Auth } from "firebase-admin/auth";
import { Firestore } from "firebase-admin/firestore";

const serviceAccount = require("../serviceAccount.json");

const firebaseConfig = {
	apiKey: process.env.apiKey as string,
	credential: admin.credential.cert(serviceAccount),
	authDomain: process.env.authDomain as string,
	projectId: process.env.projectId as string,
	storageBucket: process.env.storageBucket as string,
	appId: process.env.appId as string,
	measurementId: process.env.measurementId as string,
};

if (!admin.apps.length) {
	admin.initializeApp(firebaseConfig);
}

export const auth: Auth = admin.auth();
export const db: Firestore = admin.firestore();
