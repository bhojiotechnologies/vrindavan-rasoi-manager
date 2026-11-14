
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { COLLECTIONS } from "./schema";

export type LedgerItem = {
  itemId?: string;
  name?: string;
  itemName?: string; // पुराने रिकॉर्ड और CustomerLedger.tsx के लिए
  quantity: number;
  unit?: string;
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

function toDateTime(value: string | number | Date): number {
  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    date = new Date(year, month - 1, day, 12, 0, 0);
  } else {
    date = new Date(value);
  }

  const time = date.getTime();
  if (!Number.isFinite(time)) throw new Error("तारीख सही चुनें।");
  return time;
}

export async function getCustomerLedger(
  customerId: string
): Promise<LedgerRow[]> {
  if (!customerId) return [];

  const [salesSnap, paymentsSnap, entriesSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, COLLECTIONS.sales),
        where("customerId", "==", customerId)
      )
    ),
    getDocs(
      query(
        collection(db, COLLECTIONS.customerPayments),
        where("customerId", "==", customerId)
      )
    ),
    getDocs(
      query(
        collection(db, "customerLedgerEntries"),
        where("customerId", "==", customerId)
      )
    ),
  ]);

  const rows: LedgerRow[] = [];

  // पुराने और नए Sales रिकॉर्ड
  salesSnap.docs.forEach((doc) => {
    const data = doc.data();

    if (data.status && data.status !== "active") return;

    const total = Number(data.total || 0);
    const paid = Number(
      data.paidAmount ??
      (
        Number(data.cashAmount || 0) +
        Number(data.upiAmount || 0) +
        Number(data.advanceUsed || 0)
      )
    );

    const date = Number(data.createdAt || 0);

    if (total > 0) {
      rows.push({
        id: `${doc.id}-sale`,
        date,
        kind: "sale",
        description: `बिल ${data.invoiceNumber || ""}`,
        debit: round(total),
        credit: 0,
        balance: 0,
        invoiceNumber: data.invoiceNumber,
        items: Array.isArray(data.items) ? data.items : [],
      });
    }

    if (paid > 0) {
      rows.push({
        id: `${doc.id}-paid`,
        date: date + 1,
        kind: "payment",
        description: `बिल में प्राप्त भुगतान ${data.invoiceNumber || ""}`,
        debit: 0,
        credit: round(paid),
        balance: 0,
      });
    }
  });

  // अलग से दर्ज की गई उधार खरीद
  entriesSnap.docs.forEach((doc) => {
    const data = doc.data();

    if (data.status && data.status !== "active") return;

    rows.push({
      id: doc.id,
      date: Number(data.date || data.createdAt || 0),
      kind: "charge",
      description: data.description || "उधार खरीद",
      debit: round(Number(data.amount || 0)),
      credit: 0,
      balance: 0,
      items: Array.isArray(data.items) ? data.items : [],
    });
  });

  // ग्राहक द्वारा जमा किए गए भुगतान
  paymentsSnap.docs.forEach((doc) => {
    const data = doc.data();

    if (data.status && data.status !== "active") return;

    rows.push({
      id: doc.id,
      date: Number(data.date || data.createdAt || 0),
      kind: "payment",
      description: `जमा (${data.paymentMode || "cash"})${
        data.note ? ` - ${data.note}` : ""
      }`,
      debit: 0,
      credit: round(Number(data.amount || 0)),
      balance: 0,
    });
  });

  // तारीख के अनुसार पुराना से नया क्रम
  rows.sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));

  let balance = 0;
  rows.forEach((row) => {
    balance = round(balance + row.debit - row.credit);
    row.balance = balance;
  });

  return rows;
}

export async function recordCustomerLedgerEntry(input: {
  customerId: string;
  customerName: string;
  date: string | number | Date;
  description?: string;
  items?: LedgerItem[];
  amount?: number;
}): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Login session नहीं मिला। दोबारा Login करें।");
  }

  if (!input.customerId) {
    throw new Error("सेव ग्राहक चुनें।");
  }

  const items = (input.items || []).map((item) => {
    const name = (item.name || item.itemName || "").trim();
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);

    return {
      itemId: item.itemId || "manual-entry",
      name,
      quantity,
      unit: item.unit || "पीस",
      rate: round(rate),
      total: round(quantity * rate),
    };
  });

  if (
    items.some(
      (item) =>
        !item.name ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.rate) ||
        item.rate < 0
    )
  ) {
    throw new Error("सामान, मात्रा और रेट सही भरें।");
  }

  const amount = round(
    items.length
      ? items.reduce((sum, item) => sum + item.total, 0)
      : Number(input.amount || 0)
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("एंट्री की राशि ₹0 से अधिक होनी चाहिए।");
  }

  const now = Date.now();

  await addDoc(collection(db, "customerLedgerEntries"), {
    customerId: input.customerId,
    customerName: input.customerName,
    date: toDateTime(input.date),
    description: input.description?.trim() || "उधार खरीद",
    items,
    amount,
    createdAt: now,
    createdBy: user.uid,
    status: "active",
  });
}

export async function recordCustomerPayment(input: {
  customerId: string;
  customerName: string;
  amount: number;
  paymentMode: "cash" | "upi";
  note?: string;
  date?: string | number | Date;
}): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Login session नहीं मिला। दोबारा Login करें।");
  }

  if (!input.customerId) {
    throw new Error("ग्राहक चुनें।");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("भुगतान राशि ₹0 से अधिक होनी चाहिए।");
  }

  const now = Date.now();

  await addDoc(collection(db, COLLECTIONS.customerPayments), {
    customerId: input.customerId,
    customerName: input.customerName,
    amount: round(input.amount),
    paymentMode: input.paymentMode,
    note: input.note?.trim() || "उधार खाते में भुगतान",
    date: toDateTime(input.date ?? now),
    createdAt: now,
    createdBy: user.uid,
    status: "active",
  });
}
