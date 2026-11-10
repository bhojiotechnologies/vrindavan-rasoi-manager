import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "./schema";

export interface CustomerRecord {
  id: string;
  name: string;
  mobile: string;
  address?: string;
  createdAt: number;
  createdBy: string;
}

export interface AdvanceRecord {
  id: string;
  customerId: string;
  customerName: string;
  type: "deposit" | "adjustment" | "refund";
  amount: number;
  paymentMode?: "cash" | "upi";
  note?: string;
  date: number;
  createdAt: number;
  createdBy: string;
}

export async function getCustomers(): Promise<CustomerRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.customers),
    orderBy("name"),
    limit(500)
  ));
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<CustomerRecord, "id">),
  }));
}

export async function createCustomer(input: {
  name: string;
  mobile: string;
  address?: string;
  userId: string;
}): Promise<string> {
  const name = input.name.trim();
  const mobile = input.mobile.replace(/\D/g, "");
  if (name.length < 2) throw new Error("ग्राहक का नाम कम से कम 2 अक्षर का होना चाहिए।");
  if (!/^\d{10}$/.test(mobile)) throw new Error("10 अंकों का मोबाइल नंबर दर्ज करें।");
  if (!input.userId) throw new Error("Login session नहीं मिला। दोबारा Login करें।");

  const duplicate = await getDocs(query(
    collection(db, COLLECTIONS.customers),
    where("mobile", "==", mobile),
    limit(1)
  ));
  if (!duplicate.empty) throw new Error("इस मोबाइल नंबर का ग्राहक पहले से मौजूद है।");

  const now = Date.now();
  const result = await addDoc(collection(db, COLLECTIONS.customers), {
    name,
    mobile,
    address: input.address?.trim() || "",
    advanceBalance: 0,
    totalPurchases: 0,
    totalPayments: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: input.userId,
    status: "active",
  });
  return result.id;
}

export async function getCustomerAdvanceTransactions(customerId: string): Promise<AdvanceRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.advanceTransactions),
    where("customerId", "==", customerId)
  ));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Omit<AdvanceRecord, "id">) }))
    .sort((a, b) => b.date - a.date);
}

export function calculateAdvanceBalance(records: AdvanceRecord[]): number {
  const balance = records.reduce((total, record) => {
    if (record.type === "deposit") return total + record.amount;
    if (record.type === "refund") return total - record.amount;
    if (record.type === "adjustment") return total - record.amount;
    return total;
  }, 0);
  return Math.max(0, Number(balance.toFixed(2)));
}

export async function addCustomerAdvance(input: {
  customerId: string;
  customerName: string;
  amount: number;
  paymentMode: "cash" | "upi";
  note?: string;
  userId: string;
}): Promise<void> {
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1000000) {
    throw new Error("एडवांस राशि ₹1 से ₹10,00,000 के बीच होनी चाहिए।");
  }
  if (!input.customerId || !input.userId) throw new Error("ग्राहक या Login जानकारी उपलब्ध नहीं है।");
  const now = Date.now();
  await addDoc(collection(db, COLLECTIONS.advanceTransactions), {
    customerId: input.customerId,
    customerName: input.customerName,
    type: "deposit",
    amount: Number(input.amount.toFixed(2)),
    paymentMode: input.paymentMode,
    note: input.note?.trim() || "Advance जमा",
    date: now,
    createdAt: now,
    createdBy: input.userId,
    status: "active",
  });
}
