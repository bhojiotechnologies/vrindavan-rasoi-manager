import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  updateDoc,
} from "firebase/firestore";

import {
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";

import { auth, db, firebaseApp } from "./firebase";

export interface StaffAccount {
  uid: string;
  name: string;
  username: string;
  email: string;
  role: "staff";
  status: "active" | "inactive";
  createdAt: number;
  updatedAt?: number;
}

const staffAppName = "vrindavanStaffCreator";

const staffApp = getApps().some(
  (app) => app.name === staffAppName
)
  ? getApp(staffAppName)
  : initializeApp(firebaseApp.options, staffAppName);

const staffAuth = getAuth(staffApp);

function makeStaffEmail(username: string) {
  return `${username.toLowerCase()}@staff.vrindavanrasoi.com`;
}

function validateUsername(username: string) {
  return /^[A-Z0-9]{3,20}$/.test(username);
}

export async function getStaffAccounts(): Promise<StaffAccount[]> {
  if (!auth.currentUser) {
    throw new Error("Owner Login उपलब्ध नहीं है।");
  }

  const snapshot = await getDocs(collection(db, "users"));

  return snapshot.docs
    .map((entry) => ({
      uid: entry.id,
      ...entry.data(),
    }))
    .filter((entry) => entry.role === "staff") as StaffAccount[];
}

export async function createStaffAccount(input: {
  name: string;
  username: string;
  password: string;
}): Promise<void> {
  const owner = auth.currentUser;

  if (!owner) {
    throw new Error("पहले Owner Login करें।");
  }

  const name = input.name.trim();
  const username = input.username.trim().toUpperCase();
  const password = input.password;

  if (name.length < 2) {
    throw new Error("Staff का सही नाम लिखें।");
  }

  if (!validateUsername(username)) {
    throw new Error("Staff ID में 3 से 20 अक्षर या अंक रखें।");
  }

  if (password.length < 6) {
    throw new Error("Password कम से कम 6 अक्षर का होना चाहिए।");
  }

  const usernameRef = doc(db, "staffUsernames", username);
  const existing = await getDoc(usernameRef);

  if (existing.exists()) {
    throw new Error("यह Staff ID पहले से मौजूद है।");
  }

  const email = makeStaffEmail(username);

  let createdUser: Awaited<
    ReturnType<typeof createUserWithEmailAndPassword>
  >["user"] | null = null;

  try {
    const credential = await createUserWithEmailAndPassword(
      staffAuth,
      email,
      password
    );

    createdUser = credential.user;

    const now = Date.now();
    const profileRef = doc(db, "users", createdUser.uid);

    await runTransaction(db, async (transaction) => {
      const usernameSnapshot = await transaction.get(usernameRef);

      if (usernameSnapshot.exists()) {
        throw new Error("यह Staff ID पहले से मौजूद है।");
      }

      transaction.set(profileRef, {
        uid: createdUser!.uid,
        name,
        username,
        email,
        role: "staff",
        status: "active",
        createdAt: now,
        createdBy: owner.uid,
        updatedAt: now,
      });

      transaction.set(usernameRef, {
        uid: createdUser!.uid,
        email,
        username,
        createdAt: now,
      });
    });
  } catch (error) {
    if (createdUser) {
      try {
        await deleteUser(createdUser);
      } catch (cleanupError) {
        console.error("Staff Auth cleanup error:", cleanupError);
      }
    }

    try {
      await signOut(staffAuth);
    } catch {
      // Secondary Auth cleanup is best-effort.
    }

    throw error;
  }

  // Account बन जाने के बाद Sign Out की त्रुटि से Account डिलीट नहीं होगा।
  try {
    await signOut(staffAuth);
  } catch (error) {
    console.warn("Secondary Auth sign-out warning:", error);
  }
}

export async function setStaffStatus(
  staffUid: string,
  status: "active" | "inactive"
): Promise<void> {
  const owner = auth.currentUser;

  if (!owner) {
    throw new Error("Owner Login उपलब्ध नहीं है।");
  }

  const staffRef = doc(db, "users", staffUid);

  await updateDoc(staffRef, {
    status,
    updatedAt: Date.now(),
    updatedBy: owner.uid,
  });
}
