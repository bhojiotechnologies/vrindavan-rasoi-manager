
import {
  collection,
  doc,
  runTransaction,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  COLLECTIONS,
  type PaymentMode,
  type UserRole,
} from "./schema";

interface ExpenseInput {
  title: string;
  category: string;
  amount: number;
  paymentMode: PaymentMode;
  note?: string;
  date?: number;
  userId: string;
  userName: string;
  role: UserRole;
}

export async function createExpense(
  input: ExpenseInput
): Promise<string> {
  if (!input.title.trim() || !input.category.trim()) {
    throw new Error("Expense का नाम और Category जरूरी है।");
  }

  if (!input.userId.trim() || !input.userName.trim()) {
    throw new Error("Login User की जानकारी उपलब्ध नहीं है।");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Expense राशि शून्य से अधिक होनी चाहिए।");
  }

  const expenseRef = doc(collection(db, COLLECTIONS.expenses));
  const cashRef = doc(collection(db, COLLECTIONS.cashTransactions));
  const activityRef = doc(collection(db, COLLECTIONS.activityLogs));

  const now = input.date ?? Date.now();

  await runTransaction(db, async (transaction) => {
    transaction.set(expenseRef, {
      title: input.title.trim(),
      category: input.category.trim(),
      amount: Number(input.amount.toFixed(2)),
      paymentMode: input.paymentMode,
      note: input.note?.trim() ?? "",
      date: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      status: "active",
    });

    transaction.set(cashRef, {
      type: "expense",
      amount: Number(input.amount.toFixed(2)),
      paymentMode: input.paymentMode,
      referenceId: expenseRef.id,
      note: input.title.trim(),
      date: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      status: "active",
    });

    transaction.set(activityRef, {
      userId: input.userId,
      userName: input.userName,
      role: input.role,
      action: "EXPENSE_CREATED",
      module: "Expense",
      recordId: expenseRef.id,
      details: `${input.title.trim()} — ₹${input.amount}`,
      createdAt: now,
    });
  });

  return expenseRef.id;
}
