import admin from "firebase-admin";
import serviceAccount from "../serviceAccount.json";

const firebaseConfig = {
	apiKey: process.env.apiKey,
	credential: admin.credential.cert(serviceAccount),
	authDomain: process.env.authDomain,
	projectId: process.env.projectId,
	storageBucket: process.env.storageBucket,
	messagingSengerId: process.env.messagingSenderId,
	appId: process.env.appId,
	measurementId: process.env.measurementId,
};

admin.initializeApp(firebaseConfig);

export const auth = admin.auth();
export const db = admin.firestore();
