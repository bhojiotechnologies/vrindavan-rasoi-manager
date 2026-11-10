
import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";

import { db } from "./firebase";
import { COLLECTIONS } from "./schema";

export type CustomerLedgerType =
  | "sale"
  | "payment"
  | "advance_deposit"
  | "advance_used"
  | "advance_refund";

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  date: number;
  type: CustomerLedgerType;
  description: string;
  amount: number;
  invoiceNumber?: string;
  paymentMode?: "cash" | "upi" | "split";
  cashAmount?: number;
  upiAmount?: number;
}

export async function getCustomerLedger(
  customerId: string
): Promise<CustomerLedgerEntry[]> {
  if (!customerId.trim()) {
    throw new Error("Customer ID उपलब्ध नहीं है।");
  }

  const [salesSnapshot, paymentsSnapshot, advanceSnapshot] =
    await Promise.all([
      getDocs(query(
        collection(db, COLLECTIONS.sales),
        where("customerId", "==", customerId),
        limit(5000)
      )),
      getDocs(query(
        collection(db, COLLECTIONS.customerPayments),
        where("customerId", "==", customerId),
        limit(5000)
      )),
      getDocs(query(
        collection(db, COLLECTIONS.advanceTransactions),
        where("customerId", "==", customerId),
        limit(5000)
      )),
    ]);

  const entries: CustomerLedgerEntry[] = [];

  salesSnapshot.docs.forEach((entry) => {
    const data = entry.data();

    if (data.status === "void") return;

    entries.push({
      id: entry.id,
      customerId,
      date: Number(data.createdAt ?? data.date ?? 0),
      type: "sale",
      description: "बिक्री",
      amount: Number(data.total ?? 0),
      invoiceNumber: String(data.invoiceNumber ?? ""),
      paymentMode: data.paymentMode,
      cashAmount: Number(data.cashAmount ?? 0),
      upiAmount: Number(data.upiAmount ?? 0),
    });
  });

  paymentsSnapshot.docs.forEach((entry) => {
    const data = entry.data();

    if (data.status === "void") return;

    entries.push({
      id: entry.id,
      customerId,
      date: Number(data.date ?? data.createdAt ?? 0),
      type: "payment",
      description: String(data.note ?? "ग्राहक भुगतान"),
      amount: Number(data.amount ?? 0),
      paymentMode: data.paymentMode,
    });
  });

  advanceSnapshot.docs.forEach((entry) => {
    const data = entry.data();

    if (data.status === "void") return;

    const advanceType = data.type;

    let type: CustomerLedgerType;
    let description: string;

    if (advanceType === "deposit") {
      type = "advance_deposit";
      description = "Advance जमा";
    } else if (advanceType === "refund") {
      type = "advance_refund";
      description = "Advance वापसी";
    } else {
      type = "advance_used";
      description = "बिक्री में Advance उपयोग";
    }

    entries.push({
      id: entry.id,
      customerId,
      date: Number(data.date ?? data.createdAt ?? 0),
      type,
      description,
      amount: Number(data.amount ?? 0),
      paymentMode: data.paymentMode,
    });
  });

  return entries.sort((a, b) => b.date - a.date);
}
