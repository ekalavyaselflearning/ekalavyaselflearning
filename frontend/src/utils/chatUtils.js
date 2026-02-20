import { doc, setDoc, getDoc, collection, onSnapshot, updateDoc, query, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase"; // adjust path to your firebase config

/**
 * Generate deterministic room ID for two users
 */
export function getRoomId(email1, email2) {
  const sorted = [email1, email2].sort();
  return `${sorted[0]}__${sorted[1]}`;
}

/**
 * Send connection request from currentUser to targetUser
 */
export async function sendConnectionRequest(currentUserEmail, targetUserEmail) {
  const roomId = getRoomId(currentUserEmail, targetUserEmail);
  const timestamp = serverTimestamp();

  // Create chat document for current user
  await setDoc(doc(db, "learners", currentUserEmail, "chats", targetUserEmail), {
    status: "pending",
    initiatedBy: currentUserEmail,
    roomId,
    createdAt: timestamp,
    lastMessageAt: timestamp,
  });

  // Create chat document for target user
  await setDoc(doc(db, "learners", targetUserEmail, "chats", currentUserEmail), {
    status: "pending",
    initiatedBy: currentUserEmail,
    roomId,
    createdAt: timestamp,
    lastMessageAt: timestamp,
  });
}

/**
 * Accept connection request
 */
export async function acceptConnectionRequest(currentUserEmail, targetUserEmail) {
  // Update both chat documents to "accepted"
  await updateDoc(doc(db, "learners", currentUserEmail, "chats", targetUserEmail), {
    status: "accepted",
    acceptedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "learners", targetUserEmail, "chats", currentUserEmail), {
    status: "accepted",
    acceptedAt: serverTimestamp(),
  });
}

/**
 * Reject connection request
 */
export async function rejectConnectionRequest(currentUserEmail, targetUserEmail) {
  await updateDoc(doc(db, "learners", currentUserEmail, "chats", targetUserEmail), {
    status: "rejected",
    rejectedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "learners", targetUserEmail, "chats", currentUserEmail), {
    status: "rejected",
    rejectedAt: serverTimestamp(),
  });
}

/**
 * Get chat status between two users
 */
export async function getChatStatus(currentUserEmail, targetUserEmail) {
  const chatDoc = await getDoc(doc(db, "learners", currentUserEmail, "chats", targetUserEmail));
  if (chatDoc.exists()) {
    return chatDoc.data();
  }
  return null;
}

/**
 * Update user online status
 */
export async function updateOnlineStatus(userEmail, isOnline) {
  await setDoc(
    doc(db, "learners", userEmail),
    {
      email: userEmail,
      online: isOnline,
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Update last message in chat
 */
export async function updateLastMessage(currentUserEmail, targetUserEmail, messageText) {
  const updates = {
    lastMessage: messageText,
    lastMessageAt: serverTimestamp(),
  };

  await updateDoc(doc(db, "learners", currentUserEmail, "chats", targetUserEmail), updates);
  await updateDoc(doc(db, "learners", targetUserEmail, "chats", currentUserEmail), updates);
}