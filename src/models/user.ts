// backend/src/models/user.ts

/**
 * @fileoverview Firestore Data Models and Interfaces
 * @module models/user
 */

/**
 * Interface representing a User document in the "users" Firestore collection.
 * This model ensures data integrity for the business logic.
 *
 * @interface User
 * @property {string} uid - The unique Firebase Auth ID (used as the document ID in Firestore).
 * @property {string} name - User's first name(s).
 * @property {string} lastName - User's last name(s).
 * @property {string} email - Institutional or primary email address.
 * @property {string} username - Unique handle for the application.
 * @property {string} [avatar] - Optional URL to the user's profile picture.
 * @property {Date | FirebaseFirestore.Timestamp} createdAt - Registration date.
 * @property {boolean} profileComplete - Flag to determine if OAuth users have set their username.
 */
export interface User {
	uid: string;
	name: string;
	lastName: string;
	email: string;
	username: string;
	avatar?: string;
	createdAt: Date | FirebaseFirestore.Timestamp;
	profileComplete: boolean;
}

/**
 * Creates a new user profile in Firestore.
 *
 * @async
 * @function createUserProfile
 * @param {FirebaseFirestore.Firestore} db - The Firestore database instance.
 * @param {User} userData - The user data to be saved.
 * @returns {Promise<void>} Resolves when the document is successfully written.
 * @throws {Error} Throws an error if the database operation fails.
 */
export async function createUserProfile(
	db: FirebaseFirestore.Firestore,
	userData: User,
): Promise<void> {
	await db
		.collection("users")
		.doc(userData.uid)
		.set({
			name: userData.name,
			lastName: userData.lastName,
			email: userData.email,
			username: userData.username,
			avatar: userData.avatar || null,
			createdAt: userData.createdAt,
			profileComplete: userData.profileComplete,
		});
}
