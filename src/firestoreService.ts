import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";

import { db } from "./firebase";
import { COLLECTIONS } from "./schema";

// किसी एक रिकॉर्ड को पढ़ना
export async function getRecord(
  collectionName: string,
  recordId: string
): Promise<DocumentData | null> {
  const ref = doc(db, collectionName, recordId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

// किसी Collection के रिकॉर्ड पढ़ना
export async function getRecords(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<DocumentData[]> {
  const ref = collection(db, collectionName);
  const q = query(ref, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

// केवल Active Items पढ़ना
export async function getActiveItems(): Promise<DocumentData[]> {
  return getRecords(COLLECTIONS.items, [
    where("active", "==", true),
    orderBy("name"),
    limit(200),
  ]);
}
