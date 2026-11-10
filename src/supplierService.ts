
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  runTransaction,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";
import { COLLECTIONS, type PaymentMode } from "./schema";

export interface SupplierRecord {
  id: string;
  name: string;
  mobile: string;
  address?: string;
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
  createdAt?: number;
}

export async function getSuppliers(): Promise<SupplierRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.suppliers),
      orderBy("name")
    )
  );

  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<SupplierRecord, "id">),
  }));
}

export async function addSupplier(input: {
  name: string;
  mobile: string;
  address?: string;
  userId: string;
}): Promise<string> {
  if (!input.name.trim()) {
    throw new Error("Supplier का नाम लिखना जरूरी है।");
  }

  if (!input.mobile.trim()) {
    throw new Error("Supplier का मोबाइल नंबर लिखें।");
  }

  if (!input.userId.trim()) {
    throw new Error("Login User उपलब्ध नहीं है।");
  }

  const now = Date.now();

  const result = await addDoc(
    collection(db, COLLECTIONS.suppliers),
    {
      name: input.name.trim(),
      mobile: input.mobile.trim(),
      address: input.address?.trim() ?? "",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      status: "active",
    }
  );

  return result.id;
}

export async function updateSupplier(
  supplierId: string,
  input: {
    name: string;
    mobile: string;
    address?: string;
    userId: string;
  }
): Promise<void> {
  if (!supplierId.trim()) {
    throw new Error("Supplier ID उपलब्ध नहीं है।");
  }

  if (!input.name.trim() || !input.mobile.trim()) {
    throw new Error("Supplier का नाम और मोबाइल जरूरी हैं।");
  }

  await updateDoc(
    doc(db, COLLECTIONS.suppliers, supplierId),
    {
      name: input.name.trim(),
      mobile: input.mobile.trim(),
      address: input.address?.trim() ?? "",
      updatedAt: Date.now(),
      updatedBy: input.userId,
    }
  );
}

export async function recordSupplierPayment(input: {
  supplierId: string;
  amount: number;
  paymentMode: PaymentMode;
  userId: string;
  note?: string;
  date?: number;
}): Promise<string> {
  if (!input.supplierId.trim() || !input.userId.trim()) {
    throw new Error("Supplier या User की जानकारी उपलब्ध नहीं है।");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Payment राशि सही दर्ज करें।");
  }

  const supplierRef = doc(
    db,
    COLLECTIONS.suppliers,
    input.supplierId
  );

  const paymentRef = doc(
    collection(db, COLLECTIONS.supplierPayments)
  );

  const cashRef = doc(
    collection(db, COLLECTIONS.cashTransactions)
  );

  const activityRef = doc(
    collection(db, COLLECTIONS.activityLogs)
  );

  await runTransaction(db, async (transaction) => {
    const supplierSnapshot = await transaction.get(supplierRef);

    if (!supplierSnapshot.exists()) {
      throw new Error("Supplier नहीं मिला।");
    }

    const supplier = supplierSnapshot.data();
    const outstanding = Number(supplier.outstandingBalance ?? 0);

    if (input.amount > outstanding) {
      throw new Error(
        `Payment बकाया राशि से अधिक है। बकाया: ₹${outstanding}`
      );
    }

    const now = input.date ?? Date.now();
    const supplierName = String(supplier.name ?? "");

    transaction.update(supplierRef, {
      totalPaid: Number(
        (Number(supplier.totalPaid ?? 0) + input.amount).toFixed(2)
      ),
      outstandingBalance: Number(
        (outstanding - input.amount).toFixed(2)
      ),
      updatedAt: now,
      updatedBy: input.userId,
    });

    transaction.set(paymentRef, {
      supplierId: input.supplierId,
      supplierName,
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
      type: "cashOut",
      amount: Number(input.amount.toFixed(2)),
      paymentMode: input.paymentMode,
      referenceId: paymentRef.id,
      note: `Supplier Payment: ${supplierName}`,
      date: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      status: "active",
    });

    transaction.set(activityRef, {
      userId: input.userId,
      userName: input.userId,
      role: "owner",
      action: "SUPPLIER_PAYMENT",
      module: "Supplier",
      recordId: paymentRef.id,
      details: `${supplierName} को ₹${input.amount} भुगतान`,
      createdAt: now,
    });
  });

  return paymentRef.id;
      }
