
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  COLLECTIONS,
  type PaymentMode,
  type UserRole,
} from "./schema";

export type CashTransactionType =
  | "opening"
  | "cashIn"
  | "cashOut"
  | "sale"
  | "expense"
  | "refund";

export interface CashTransactionRecord {
  id: string;
  type: CashTransactionType;
  amount: number;
  paymentMode: PaymentMode;
  referenceId?: string;
  note?: string;
  date: number;
  createdBy: string;
}

export async function recordCashTransaction(input: {
  type: CashTransactionType;
  amount: number;
  paymentMode: PaymentMode;
  userId: string;
  role: UserRole;
  referenceId?: string;
  note?: string;
  date?: number;
}): Promise<string> {
  if (!input.userId.trim()) {
    throw new Error("Login जानकारी उपलब्ध नहीं है।");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("राशि शून्य से अधिक होनी चाहिए।");
  }

  if (input.amount > 10000000) {
    throw new Error("राशि ₹1 करोड़ से अधिक नहीं हो सकती।");
  }

  if (input.type === "opening" && input.role !== "owner") {
    throw new Error("Opening Cash केवल Owner दर्ज कर सकता है।");
  }

  const now = Date.now();

  const result = await addDoc(
    collection(db, COLLECTIONS.cashTransactions),
    {
      type: input.type,
      amount: Number(input.amount.toFixed(2)),
      paymentMode: input.paymentMode,
      referenceId: input.referenceId ?? "",
      note: input.note?.trim() ?? "",
      date: input.date ?? now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      status: "active",
    }
  );

  return result.id;
}

export async function getCashTransactions(
  startDate: number,
  endDate: number
): Promise<CashTransactionRecord[]> {
  if (
    !Number.isFinite(startDate) ||
    !Number.isFinite(endDate) ||
    startDate > endDate
  ) {
    throw new Error("तारीख की सीमा सही दर्ज करें।");
  }

  const recordsQuery = query(
    collection(db, COLLECTIONS.cashTransactions),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "desc")
  );

  const snapshot = await getDocs(recordsQuery);

  return snapshot.docs
    .filter((entry) => entry.data().status !== "void")
    .map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<CashTransactionRecord, "id">),
    }));
}

export function calculateCashAndUpi(
  records: CashTransactionRecord[]
): {
  cashIn: number;
  cashOut: number;
  upiIn: number;
  upiOut: number;
} {
  let cashIn = 0;
  let cashOut = 0;
  let upiIn = 0;
  let upiOut = 0;

  records.forEach((record) => {
    const isOut =
      record.type === "cashOut" ||
      record.type === "expense" ||
      record.type === "refund";

    if (record.paymentMode === "cash") {
      if (isOut) cashOut += record.amount;
      else cashIn += record.amount;
    } else {
      if (isOut) upiOut += record.amount;
      else upiIn += record.amount;
    }
  });

  return {
    cashIn: Number(cashIn.toFixed(2)),
    cashOut: Number(cashOut.toFixed(2)),
    upiIn: Number(upiIn.toFixed(2)),
    upiOut: Number(upiOut.toFixed(2)),
  };
}
