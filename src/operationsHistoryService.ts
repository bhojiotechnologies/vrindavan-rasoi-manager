
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";

import { db } from "./firebase";
import { COLLECTIONS } from "./schema";

export interface PurchaseHistoryRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber?: string;
  items: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    unit: string;
    rate: number;
    total: number;
  }>;
  total: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentMode: string;
  date: number;
  createdBy: string;
  status?: string;
}

export interface SupplierPaymentHistoryRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  purchaseId?: string;
  amount: number;
  paymentMode: string;
  note?: string;
  date: number;
  createdBy: string;
}

export interface ExpenseHistoryRecord {
  id: string;
  title: string;
  category: string;
  amount: number;
  paymentMode: string;
  note?: string;
  date: number;
  createdBy: string;
}

export interface WastageHistoryRecord {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  estimatedLoss: number;
  reason: string;
  date: number;
  createdBy: string;
}

// Purchase History
export async function getPurchaseHistory(
  maxRecords = 200
): Promise<PurchaseHistoryRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.purchases),
      orderBy("date", "desc"),
      limit(maxRecords)
    )
  );

  return snapshot.docs
    .filter((entry) => entry.data().status !== "void")
    .map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<PurchaseHistoryRecord, "id">),
    }));
}

// Supplier Payment History
export async function getSupplierPaymentHistory(
  maxRecords = 200
): Promise<SupplierPaymentHistoryRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.supplierPayments),
      orderBy("date", "desc"),
      limit(maxRecords)
    )
  );

  return snapshot.docs
    .map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<SupplierPaymentHistoryRecord, "id">),
    }));
}

// Expense History
export async function getExpenseHistory(
  maxRecords = 200
): Promise<ExpenseHistoryRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.expenses),
      orderBy("date", "desc"),
      limit(maxRecords)
    )
  );

  return snapshot.docs
    .filter((entry) => entry.data().status !== "void")
    .map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<ExpenseHistoryRecord, "id">),
    }));
}

// Wastage History
export async function getWastageHistory(
  maxRecords = 200
): Promise<WastageHistoryRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.wastage),
      orderBy("date", "desc"),
      limit(maxRecords)
    )
  );

  return snapshot.docs
    .filter((entry) => entry.data().status !== "void")
    .map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<WastageHistoryRecord, "id">),
    }));
}

// किसी एक Supplier की Purchase History
export async function getSupplierPurchases(
  supplierId: string
): Promise<PurchaseHistoryRecord[]> {
  if (!supplierId.trim()) {
    throw new Error("Supplier ID उपलब्ध नहीं है।");
  }

  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.purchases),
      where("supplierId", "==", supplierId),
      orderBy("date", "desc"),
      limit(200)
    )
  );

  return snapshot.docs
    .filter((entry) => entry.data().status !== "void")
    .map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<PurchaseHistoryRecord, "id">),
    }));
      }
