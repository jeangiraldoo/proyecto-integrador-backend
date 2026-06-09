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

/**
 * Summary of a profile-deletion operation. Useful for logging and for building
 * the evidence trail required by US-05 / BE-08.
 *
 * @interface ProfileDeletionResult
 * @property {string | null} username - Username resolved from `uids/{uid}`, if any.
 * @property {string[]} deletedPaths - Firestore document paths targeted for deletion.
 */
export interface ProfileDeletionResult {
	username: string | null;
	deletedPaths: string[];
}

/**
 * Permanently removes a user's Firestore profile documents (hard delete).
 *
 * Resolves the username from the `uids/{uid}` reverse-lookup collection and
 * deletes every profile document associated with the account in a single
 * atomic batch. To stay robust against the two data models present in the
 * project, it targets (when they exist):
 *   - `users/{username}` — public profile keyed by username (frontend model)
 *   - `uids/{uid}`       — reverse lookup keyed by Auth UID (frontend model)
 *   - `users/{uid}`      — legacy profile keyed by UID (early backend model)
 *
 * No soft-delete (logical deletion) is performed, as required by US-05.
 *
 * @async
 * @function deleteUserProfile
 * @param {FirebaseFirestore.Firestore} db - The Firestore (admin) database instance.
 * @param {string} uid - The authenticated user's Firebase Auth UID.
 * @returns {Promise<ProfileDeletionResult>} Summary of the deletion.
 * @throws {Error} If the Firestore batch commit fails.
 */
export async function deleteUserProfile(
	db: FirebaseFirestore.Firestore,
	uid: string,
): Promise<ProfileDeletionResult> {
	const batch = db.batch();
	const deletedPaths: string[] = [];

	// Resolve the username via the reverse-lookup document, if it exists.
	const uidRef = db.collection("uids").doc(uid);
	const uidSnap = await uidRef.get();
	const username = uidSnap.exists
		? ((uidSnap.data()?.username as string | undefined) ?? null)
		: null;

	// Public profile keyed by username (frontend data model).
	if (username) {
		const usernameRef = db.collection("users").doc(username);
		batch.delete(usernameRef);
		deletedPaths.push(usernameRef.path);
	}

	// Reverse-lookup document (frontend data model).
	if (uidSnap.exists) {
		batch.delete(uidRef);
		deletedPaths.push(uidRef.path);
	}

	// Legacy UID-keyed profile (early backend signup flow). Deleting a
	// non-existent document is a safe no-op in Firestore.
	const legacyRef = db.collection("users").doc(uid);
	batch.delete(legacyRef);
	deletedPaths.push(legacyRef.path);

	await batch.commit();

	return { username, deletedPaths };
}
