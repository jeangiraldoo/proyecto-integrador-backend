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

/** Error code returned when a username is already taken by another account. */
export const USERNAME_TAKEN_CODE = "auth/username-already-exists";

/** Error code returned when the authenticated user has no profile document. */
export const PROFILE_NOT_FOUND_CODE = "profile/not-found";

/**
 * Fields a student is allowed to modify on their own profile (US-04).
 * `undefined` means "leave unchanged"; only provided keys are updated.
 *
 * @interface ProfileUpdate
 */
export interface ProfileUpdate {
	name?: string;
	lastName?: string;
	username?: string;
	avatarUrl?: string | null;
}

/**
 * Creates an Error carrying a `code` property so route handlers can map it to a
 * specific HTTP response (mirrors the shape of Firebase Admin SDK errors).
 */
function codedError(message: string, code: string): Error {
	return Object.assign(new Error(message), { code });
}

/**
 * Reads the authenticated user's profile.
 *
 * Resolves the username from the `uids/{uid}` reverse-lookup and returns the
 * `users/{username}` document. Reads strictly the document tied to the given UID.
 *
 * @async
 * @function getUserProfile
 * @param {FirebaseFirestore.Firestore} db - The Firestore (admin) database instance.
 * @param {string} uid - The authenticated user's Firebase Auth UID.
 * @returns {Promise<FirebaseFirestore.DocumentData>} The profile document (with `id`).
 * @throws {Error} With code `profile/not-found` if no profile exists for the UID.
 */
export async function getUserProfile(
	db: FirebaseFirestore.Firestore,
	uid: string,
): Promise<FirebaseFirestore.DocumentData> {
	const uidSnap = await db.collection("uids").doc(uid).get();
	const username = uidSnap.exists ? (uidSnap.data()?.username as string | undefined) : undefined;
	if (!username) {
		throw codedError("Profile not found for the authenticated user", PROFILE_NOT_FOUND_CODE);
	}

	const userSnap = await db.collection("users").doc(username).get();
	if (!userSnap.exists) {
		throw codedError("Profile not found for the authenticated user", PROFILE_NOT_FOUND_CODE);
	}

	return { id: userSnap.id, ...userSnap.data() };
}

/**
 * Updates the authenticated user's profile with strict, transactional username
 * re-validation.
 *
 * Profiles are keyed by username (`users/{username}`), so changing the username
 * moves the document: a new doc is created, the old one deleted, and the
 * `uids/{uid}` reverse-lookup repointed — all inside a single transaction to
 * prevent races. If the requested username already belongs to a *different*
 * account, the write is aborted with a `auth/username-already-exists` error.
 * Reusing the user's own current username is always allowed (no self-collision).
 *
 * @async
 * @function updateUserProfile
 * @param {FirebaseFirestore.Firestore} db - The Firestore (admin) database instance.
 * @param {string} uid - The authenticated user's Firebase Auth UID.
 * @param {ProfileUpdate} updates - Fields to change (only provided keys are written).
 * @returns {Promise<FirebaseFirestore.DocumentData>} The updated profile (with `id`).
 * @throws {Error} `profile/not-found` if the user has no profile.
 * @throws {Error} `auth/username-already-exists` if the username is taken by another user.
 */
export async function updateUserProfile(
	db: FirebaseFirestore.Firestore,
	uid: string,
	updates: ProfileUpdate,
): Promise<FirebaseFirestore.DocumentData> {
	return db.runTransaction(async (tx) => {
		// --- Reads first (Firestore requires all reads before any writes) ---
		const uidRef = db.collection("uids").doc(uid);
		const uidSnap = await tx.get(uidRef);
		const currentUsername = uidSnap.exists
			? (uidSnap.data()?.username as string | undefined)
			: undefined;
		if (!currentUsername) {
			throw codedError("Profile not found for the authenticated user", PROFILE_NOT_FOUND_CODE);
		}

		const currentRef = db.collection("users").doc(currentUsername);
		const currentSnap = await tx.get(currentRef);
		if (!currentSnap.exists) {
			throw codedError("Profile not found for the authenticated user", PROFILE_NOT_FOUND_CODE);
		}
		const current = currentSnap.data() ?? {};

		const newUsername = updates.username ? updates.username.toLowerCase() : currentUsername;
		const usernameChanging = newUsername !== currentUsername;

		let targetRef = currentRef;
		if (usernameChanging) {
			targetRef = db.collection("users").doc(newUsername);
			const targetSnap = await tx.get(targetRef);
			// Collision only if the doc exists and belongs to ANOTHER uid.
			if (targetSnap.exists && targetSnap.data()?.uid !== uid) {
				throw codedError("Username already in use", USERNAME_TAKEN_CODE);
			}
		}

		// --- Build the merged profile (only allowed mutable fields) ---
		const merged: FirebaseFirestore.DocumentData = { ...current, uid, username: newUsername };
		if (updates.name !== undefined) merged.name = updates.name;
		if (updates.lastName !== undefined) merged.lastName = updates.lastName;
		if (updates.avatarUrl !== undefined) merged.avatarUrl = updates.avatarUrl;
		if (updates.name !== undefined || updates.lastName !== undefined) {
			merged.displayName = `${merged.name ?? ""} ${merged.lastName ?? ""}`.trim();
		}

		// --- Writes ---
		if (usernameChanging) {
			tx.set(targetRef, merged);
			tx.delete(currentRef);
			tx.update(uidRef, { username: newUsername });
		} else {
			tx.set(currentRef, merged);
		}

		return { id: newUsername, ...merged };
	});
}
