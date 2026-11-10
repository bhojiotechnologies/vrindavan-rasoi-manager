
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  updateDoc,
  writeBatch,
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

function makeStaffEmail(username: string): string {
  return `${username.toLowerCase()}@staff.vrindavanrasoi.com`;
}

function validateUsername(username: string): boolean {
  return /^[A-Z0-9]{3,20}$/.test(username);
}

// सभी Staff Accounts प्राप्त करना
export async function getStaffAccounts(): Promise<StaffAccount[]> {
  if (!auth.currentUser) {
    throw new Error("Owner Login उपलब्ध नहीं है।");
  }

  const snapshot = await getDocs(collection(db, "users"));

  const accounts: StaffAccount[] = snapshot.docs.map((entry) => {
    const data = entry.data();

    return {
      uid: entry.id,
      name: String(data.name ?? ""),
      username: String(data.username ?? ""),
      email: String(data.email ?? ""),
      role: data.role as "staff",
      status: data.status as "active" | "inactive",
      createdAt: Number(data.createdAt ?? 0),
      updatedAt:
        typeof data.updatedAt === "number"
          ? data.updatedAt
          : undefined,
    };
  });

  return accounts.filter((entry) => entry.role === "staff");
}

// नया Staff Account बनाना
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
      // Secondary Auth cleanup
    }

    throw error;
  }

  try {
    await signOut(staffAuth);
  } catch (error) {
    console.warn("Secondary Auth sign-out warning:", error);
  }
}

// किसी एक Staff को Active / Inactive करना
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

  await writeActivityLog(
    "Staff Account Status Changed",
    "Staff Management"
  );
}

// Emergency Lock: सभी Staff Accounts एक साथ Inactive करना
export async function lockAllStaffAccounts(): Promise<number> {
  const owner = auth.currentUser;

  if (!owner) {
    throw new Error("पहले Owner Login करें।");
  }

  const snapshot = await getDocs(collection(db, "users"));

  const staffDocs = snapshot.docs.filter(
    (entry) => entry.data().role === "staff"
      && entry.data().status === "active"
  );

  if (staffDocs.length === 0) {
    return 0;
  }

  // Firestore Batch की सीमा 500 Operations है।
  // इसलिए बड़े Staff समूह को छोटे Batches में बाँटते हैं।
  const chunkSize = 450;
  let lockedCount = 0;

  for (let i = 0; i < staffDocs.length; i += chunkSize) {
    const chunk = staffDocs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    const now = Date.now();

    chunk.forEach((entry) => {
      batch.update(entry.ref, {
        status: "inactive",
        updatedAt: now,
        updatedBy: owner.uid,
      });
    });

    await batch.commit();
    lockedCount += chunk.length;
  }

  await writeActivityLog(
    `Emergency Lock: ${lockedCount} Staff Accounts Inactivated`,
    "Staff Management"
  );

  return lockedCount;
}

// Activity Log में Action दर्ज करना
export async function writeActivityLog(
  action: string,
  module: string
): Promise<void> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Login उपलब्ध नहीं है।");
  }

  const profileRef = doc(db, "users", currentUser.uid);
  const profileSnapshot = await getDoc(profileRef);

  if (!profileSnapshot.exists()) {
    throw new Error("User Profile नहीं मिला।");
  }

  const profile = profileSnapshot.data();

  if (profile.status !== "active") {
    throw new Error("Inactive Account Activity Log नहीं लिख सकता।");
  }

  await addDoc(collection(db, "activityLogs"), {
    userId: currentUser.uid,
    userName: String(profile.name ?? profile.username ?? "Unknown"),
    role: String(profile.role ?? "unknown"),
    action,
    module,
    createdAt: Date.now(),
  });
}
