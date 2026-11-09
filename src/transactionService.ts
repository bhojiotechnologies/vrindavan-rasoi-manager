import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";

import { db } from "./firebase";

export interface RecordToCreate {
  collectionName: string;
  recordId: string;
  data: DocumentData;
}

export interface RecordToUpdate {
  collectionName: string;
  recordId: string;
  data: DocumentData;
}

function validateRecords(
  records: Array<{ collectionName: string; recordId: string }>
): void {
  if (records.length === 0) {
    throw new Error("कम से कम एक रिकॉर्ड आवश्यक है।");
  }

  const uniqueIds = new Set<string>();

  for (const record of records) {
    if (!record.collectionName.trim() || !record.recordId.trim()) {
      throw new Error("Collection या Record ID खाली नहीं हो सकती।");
    }

    const key = `${record.collectionName}/${record.recordId}`;

    if (uniqueIds.has(key)) {
      throw new Error("एक ही रिकॉर्ड को दो बार शामिल नहीं कर सकते।");
    }

    uniqueIds.add(key);
  }
}

/**
 * कई नए रिकॉर्ड को एक Firestore transaction में बनाता है।
 * यदि कोई रिकॉर्ड पहले से मौजूद है तो पूरा transaction रद्द होगा।
 */
export async function createAtomicRecords(
  records: RecordToCreate[]
): Promise<void> {
  validateRecords(records);

  await runTransaction(db, async (transaction) => {
    const references = records.map((record) =>
      doc(collection(db, record.collectionName), record.recordId)
    );

    const snapshots = await Promise.all(
      references.map((reference) => transaction.get(reference))
    );

    if (snapshots.some((snapshot) => snapshot.exists())) {
      throw new Error("यह रिकॉर्ड पहले से मौजूद है। Duplicate entry रोकी गई।");
    }

    records.forEach((record, index) => {
      transaction.set(references[index], {
        ...record.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  });
}

/**
 * कई पुराने रिकॉर्ड को एक transaction में अपडेट करता है।
 * सभी रिकॉर्ड मौजूद होने पर ही बदलाव लागू होंगे।
 */
export async function updateAtomicRecords(
  records: RecordToUpdate[]
): Promise<void> {
  validateRecords(records);

  await runTransaction(db, async (transaction) => {
    const references = records.map((record) =>
      doc(db, record.collectionName, record.recordId)
    );

    const snapshots = await Promise.all(
      references.map((reference) => transaction.get(reference))
    );

    if (snapshots.some((snapshot) => !snapshot.exists())) {
      throw new Error("अपडेट के लिए आवश्यक रिकॉर्ड नहीं मिला।");
    }

    records.forEach((record, index) => {
      transaction.update(references[index], {
        ...record.data,
        updatedAt: serverTimestamp(),
      });
    });
  });
}
