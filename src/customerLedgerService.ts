import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { COLLECTIONS } from "./schema";

export type LedgerItem = {
  itemId?: string;
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
};

export type LedgerRow = {
  id: string;
  date: number;
  kind: "sale" | "charge" | "payment";
  description: string;
  debit: number;
  credit: number;
  balance: number;
  invoiceNumber?: string;
  items?: LedgerItem[];
};

const round = (n: number) => Number(n.toFixed(2));
const toDateTime = (value: string | number | Date) => {
  const d = value instanceof Date ? value : (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? (() => { const [y,m,day] = value.split("-").map(Number); return new Date(y, m - 1, day, 12, 0, 0); })() : new Date(value));
  const time = d.getTime();
  if (!Number.isFinite(time)) throw new Error("तारीख सही चुनें।");
  return time;
};

export async function getCustomerLedger(customerId: string): Promise<LedgerRow[]> {
  if (!customerId) return [];
  const [salesSnap, paymentsSnap, entriesSnap] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.sales), where("customerId", "==", customerId))),
    getDocs(query(collection(db, COLLECTIONS.customerPayments), where("customerId", "==", customerId))),
    getDocs(query(collection(db, "customerLedgerEntries"), where("customerId", "==", customerId))),
  ]);

  const rows: LedgerRow[] = [];
  salesSnap.docs.forEach((d) => {
    const x = d.data();
    if (x.status && x.status !== "active") return;
    const total = Number(x.total || 0);
    const paid = Number(x.paidAmount ?? (Number(x.cashAmount || 0) + Number(x.upiAmount || 0) + Number(x.advanceUsed || 0)));
    const date = Number(x.createdAt || 0);
    rows.push({ id: `${d.id}-sale`, date, kind: "sale", description: `बिल ${x.invoiceNumber || ""}`, debit: round(total), credit: 0, balance: 0, invoiceNumber: x.invoiceNumber, items: Array.isArray(x.items) ? x.items : [] });
    if (paid > 0) rows.push({ id: `${d.id}-paid`, date: date + 1, kind: "payment", description: `बिल में प्राप्त भुगतान ${x.invoiceNumber || ""}`, debit: 0, credit: round(paid), balance: 0 });
  });

  entriesSnap.docs.forEach((d) => {
    const x = d.data();
    if (x.status && x.status !== "active") return;
    rows.push({ id: d.id, date: Number(x.date || x.createdAt || 0), kind: "charge", description: x.description || "उधार खरीद", debit: round(Number(x.amount || 0)), credit: 0, balance: 0, items: Array.isArray(x.items) ? x.items : [] });
  });

  paymentsSnap.docs.forEach((d) => {
    const x = d.data();
    if (x.status && x.status !== "active") return;
    rows.push({ id: d.id, date: Number(x.date || x.createdAt || 0), kind: "payment", description: `जमा (${x.paymentMode || "cash"})${x.note ? ` - ${x.note}` : ""}`, debit: 0, credit: round(Number(x.amount || 0)), balance: 0 });
  });

  rows.sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));
  let balance = 0;
  rows.forEach((row) => { balance = round(balance + row.debit - row.credit); row.balance = balance; });
  return rows;
}

export async function recordCustomerLedgerEntry(input: {
  customerId: string;
  customerName: string;
  date: string | number | Date;
  description?: string;
  items?: LedgerItem[];
  amount?: number;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Login session नहीं मिला। दोबारा Login करें।");
  if (!input.customerId) throw new Error("सेव ग्राहक चुनें।");
  const items = (input.items || []).map((item) => ({
    itemId: item.itemId || "manual-entry",
    name: item.name.trim(), quantity: Number(item.quantity), unit: item.unit || "पीस",
    rate: round(Number(item.rate)), total: round(Number(item.quantity) * Number(item.rate)),
  }));
  const amount = round(items.length ? items.reduce((sum, item) => sum + item.total, 0) : Number(input.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("एंट्री की राशि ₹0 से अधिक होनी चाहिए।");
  if (items.some((item) => !item.name || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.rate) || item.rate < 0)) throw new Error("सामान, मात्रा और रेट सही भरें।");
  const now = Date.now();
  await addDoc(collection(db, "customerLedgerEntries"), {
    customerId: input.customerId, customerName: input.customerName,
    date: toDateTime(input.date), description: input.description?.trim() || "उधार खरीद",
    items, amount, createdAt: now, createdBy: user.uid, status: "active",
  });
}

export async function recordCustomerPayment(input: {
  customerId: string; customerName: string; amount: number;
  paymentMode: "cash" | "upi"; note?: string; date?: string | number | Date;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Login session नहीं मिला। दोबारा Login करें।");
  if (!input.customerId) throw new Error("ग्राहक चुनें।");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("भुगतान राशि ₹0 से अधिक होनी चाहिए।");
  const now = Date.now();
  await addDoc(collection(db, COLLECTIONS.customerPayments), {
    customerId: input.customerId, customerName: input.customerName,
    amount: round(input.amount), paymentMode: input.paymentMode,
    note: input.note?.trim() || "उधार खाते में भुगतान", date: toDateTime(input.date ?? now),
    createdAt: now, createdBy: user.uid, status: "active",
  });
                                                 }
