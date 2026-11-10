
import {
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  COLLECTIONS,
  type UserRole,
} from "./schema";

export interface ActivityLogRecord {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  action: string;
  module: string;
  recordId?: string;
  details?: string;
  createdAt: number;
}

export async function recordActivity(input: {
  userId: string;
  userName: string;
  role: UserRole;
  action: string;
  module: string;
  recordId?: string;
  details?: string;
}): Promise<string> {
  if (
    !input.userId.trim() ||
    !input.userName.trim() ||
    !input.action.trim() ||
    !input.module.trim()
  ) {
    throw new Error("Activity Log की जरूरी जानकारी उपलब्ध नहीं है।");
  }

  const result = await addDoc(
    collection(db, COLLECTIONS.activityLogs),
    {
      userId: input.userId,
      userName: input.userName,
      role: input.role,
      action: input.action.trim(),
      module: input.module.trim(),
      recordId: input.recordId ?? "",
      details: input.details?.trim() ?? "",
      createdAt: Date.now(),
    }
  );

  return result.id;
}

export async function getRecentActivity(
  maxRecords = 100
): Promise<ActivityLogRecord[]> {
  const safeLimit = Math.min(
    500,
    Math.max(1, Math.floor(maxRecords))
  );

  const activityQuery = query(
    collection(db, COLLECTIONS.activityLogs),
    orderBy("createdAt", "desc"),
    limit(safeLimit)
  );

  const snapshot = await getDocs(activityQuery);

  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<ActivityLogRecord, "id">),
  }));
}

export async function getUserActivity(
  userId: string,
  maxRecords = 100
): Promise<ActivityLogRecord[]> {
  if (!userId.trim()) {
    throw new Error("User ID उपलब्ध नहीं है।");
  }

  const safeLimit = Math.min(
    500,
    Math.max(1, Math.floor(maxRecords))
  );

  const activityQuery = query(
    collection(db, COLLECTIONS.activityLogs),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(safeLimit)
  );

  const snapshot = await getDocs(activityQuery);

  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<ActivityLogRecord, "id">),
  }));
}
