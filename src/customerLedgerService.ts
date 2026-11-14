import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "./firebase";
import { COLLECTIONS } from "./schema";

export type LedgerRow = {
  id: string; date: number; kind: "sale" | "payment"; description: string;
  debit: number; credit: number; balance: number; invoiceNumber?: string;
  items?: Array<{ name?: string; itemName?: string; quantity?: number; unit?: string; rate?: number; total?: number }>;
};
const round = (n: number) => Number(n.toFixed(2));

export async function getCustomerLedger(customerId: string): Promise<LedgerRow[]> {
  const [salesSnap, paymentsSnap] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.sales), where("customerId", "==", customerId))),
    getDocs(query(collection(db, COLLECTIONS.customerPayments), where("customerId", "==", customerId))),
  ]);
  const rows: LedgerRow[] = [];
  salesSnap.docs.forEach((d) => {
    const x = d.data(); if (x.status && x.status !== "active") return;
    const total = Number(x.total || 0); const paid = Number(x.paidAmount ?? (Number(x.cashAmount || 0) + Number(x.upiAmount || 0) + Number(x.advanceUsed || 0)));
    rows.push({ id: `${d.id}-sale`, date: Number(x.createdAt || 0), kind: "sale", description: `खरीद / बिल ${x.invoiceNumber || ""}`, debit: round(total), credit: 0, balance: 0, invoiceNumber: x.invoiceNumber, items: Array.isArray(x.items) ? x.items : [] });
    if (paid > 0) rows.push({ id: `${d.id}-paid`, date: Number(x.createdAt || 0) + 1, kind: "payment", description: `बिल में प्राप्त भुगतान ${x.invoiceNumber || ""}`, debit: 0, credit: round(paid), balance: 0 });
  });
  paymentsSnap.docs.forEach((d) => {
    const x = d.data(); if (x.status && x.status !== "active") return;
    rows.push({ id: d.id, date: Number(x.date || x.createdAt || 0), kind: "payment", description: `जमा (${x.paymentMode || "cash"})${x.note ? ` - ${x.note}` : ""}`, debit: 0, credit: Number(x.amount || 0), balance: 0 });
  });
  rows.sort((a,b) => a.date - b.date || a.id.localeCompare(b.id));
  let balance = 0;
  rows.forEach((r) => { balance = round(balance + r.debit - r.credit); r.balance = balance; });
  return rows;
}

export async function recordCustomerPayment(input: { customerId: string; customerName: string; amount: number; paymentMode: "cash" | "upi"; note?: string }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Login session नहीं मिला। दोबारा Login करें।");
  if (!input.customerId) throw new Error("ग्राहक चुनें।");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("भुगतान राशि ₹0 से अधिक होनी चाहिए।");
  const now = Date.now();
  await addDoc(collection(db, COLLECTIONS.customerPayments), {
    customerId: input.customerId, customerName: input.customerName,
    amount: round(input.amount), paymentMode: input.paymentMode,
    note: input.note?.trim() || "उधार खाते में भुगतान", date: now,
    createdAt: now, createdBy: user.uid, status: "active",
  });
}
