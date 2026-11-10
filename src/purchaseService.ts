
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
  type PurchaseItem,
} from "./schema";

interface PurchaseInput {
  supplierId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    rate: number;
  }>;
  paidAmount: number;
  paymentMode: PaymentMode;
  invoiceNumber?: string;
  date?: number;
  note?: string;
  userId: string;
  userName: string;
  role: UserRole;
}

export async function createPurchase(
  input: PurchaseInput
): Promise<string> {
  if (!input.supplierId.trim() || !input.userId.trim()) {
    throw new Error("Supplier या User की जानकारी उपलब्ध नहीं है।");
  }

  if (!input.items.length) {
    throw new Error("कम से कम एक Item जोड़ें।");
  }

  if (
    !Number.isFinite(input.paidAmount) ||
    input.paidAmount < 0
  ) {
    throw new Error("Paid Amount सही दर्ज करें।");
  }

  input.items.forEach((item) => {
    if (
      !item.itemId.trim() ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.rate) ||
      item.rate < 0
    ) {
      throw new Error("Purchase Item की जानकारी सही नहीं है।");
    }
  });

  const purchaseRef = doc(collection(db, COLLECTIONS.purchases));
  const supplierRef = doc(
    db,
    COLLECTIONS.suppliers,
    input.supplierId
  );

  const paymentRef =
    input.paidAmount > 0
      ? doc(collection(db, COLLECTIONS.supplierPayments))
      : null;

  const cashRef =
    input.paidAmount > 0
      ? doc(collection(db, COLLECTIONS.cashTransactions))
      : null;

  const activityRef = doc(
    collection(db, COLLECTIONS.activityLogs)
  );

  const itemGroups = new Map<
    string,
    { quantity: number; rate: number }
  >();

  input.items.forEach((item) => {
    const existing = itemGroups.get(item.itemId);

    if (existing) {
      if (existing.rate !== item.rate) {
        throw new Error(
          "एक ही Purchase में एक Item की अलग-अलग Rate दर्ज न करें।"
        );
      }

      existing.quantity += item.quantity;
    } else {
      itemGroups.set(item.itemId, {
        quantity: item.quantity,
        rate: item.rate,
      });
    }
  });

  const itemRefs = Array.from(itemGroups.keys()).map((id) =>
    doc(db, COLLECTIONS.items, id)
  );

  const movementRefs = Array.from(itemGroups.keys()).map(() =>
    doc(collection(db, COLLECTIONS.stockMovements))
  );

  await runTransaction(db, async (transaction) => {
    const supplierSnapshot = await transaction.get(supplierRef);

    if (!supplierSnapshot.exists()) {
      throw new Error("Supplier नहीं मिला।");
    }

    const itemSnapshots = await Promise.all(
      itemRefs.map((ref) => transaction.get(ref))
    );

    const supplier = supplierSnapshot.data();
    const supplierName = String(supplier.name ?? "");

    const purchaseItems: PurchaseItem[] = [];
    let subtotal = 0;

    const stockUpdates: Array<{
      ref: typeof itemRefs[number];
      movementRef: typeof movementRefs[number];
      itemName: string;
      quantity: number;
      previousStock: number;
      newStock: number;
      rate: number;
    }> = [];

    itemSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) {
        throw new Error("Purchase का कोई Item उपलब्ध नहीं है।");
      }

      const itemData = snapshot.data();
      const itemId = snapshot.id;
      const group = itemGroups.get(itemId)!;

      if (itemData.active === false) {
        throw new Error(
          `${String(itemData.name)} Inactive है।`
        );
      }

      const previousStock = Number(itemData.stock ?? 0);

      if (!Number.isFinite(previousStock) || previousStock < 0) {
        throw new Error("Item का मौजूदा Stock सही नहीं है।");
      }

      const newStock = Number(
        (previousStock + group.quantity).toFixed(3)
      );

      const itemName = String(itemData.name ?? "");
      const unit = String(itemData.unit ?? "");
      const lineTotal = Number(
        (group.quantity * group.rate).toFixed(2)
      );

      subtotal += lineTotal;

      purchaseItems.push({
        itemId,
        itemName,
        quantity: group.quantity,
        unit,
        rate: group.rate,
        total: lineTotal,
      });

      stockUpdates.push({
        ref: itemRefs[index],
        movementRef: movementRefs[index],
        itemName,
        quantity: group.quantity,
        previousStock,
        newStock,
        rate: group.rate,
      });
    });

    subtotal = Number(subtotal.toFixed(2));

    if (input.paidAmount > subtotal) {
      throw new Error("Paid Amount Purchase Total से अधिक नहीं हो सकता।");
    }

    const outstanding = Number(
      (subtotal - input.paidAmount).toFixed(2)
    );

    const now = input.date ?? Date.now();

    // सभी Reads पूरे होने के बाद Writes शुरू।
    transaction.set(purchaseRef, {
      supplierId: input.supplierId,
      supplierName,
      invoiceNumber: input.invoiceNumber?.trim() ?? "",
      items: purchaseItems,
      subtotal,
      total: subtotal,
      paidAmount: input.paidAmount,
      outstandingAmount: outstanding,
      paymentMode: input.paymentMode,
      note: input.note?.trim() ?? "",
      date: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      status: "active",
    });

    transaction.update(supplierRef, {
      totalPurchases: Number(
        (Number(supplier.totalPurchases ?? 0) + subtotal).toFixed(2)
      ),
      totalPaid: Number(
        (Number(supplier.totalPaid ?? 0) + input.paidAmount).toFixed(2)
      ),
      outstandingBalance: Number(
        (Number(supplier.outstandingBalance ?? 0) + outstanding).toFixed(2)
      ),
      updatedAt: now,
      updatedBy: input.userId,
    });

    stockUpdates.forEach((update) => {
      transaction.update(update.ref, {
        stock: update.newStock,
        updatedAt: now,
      });

      transaction.set(update.movementRef, {
        itemId: update.ref.id,
        itemName: update.itemName,
        type: "purchase",
        quantity: update.quantity,
        previousStock: update.previousStock,
        newStock: update.newStock,
        referenceId: purchaseRef.id,
        note: "Purchase Entry",
        createdAt: now,
        updatedAt: now,
        createdBy: input.userId,
        status: "active",
      });
    });

    if (paymentRef && cashRef) {
      transaction.set(paymentRef, {
        supplierId: input.supplierId,
        supplierName,
        purchaseId: purchaseRef.id,
        amount: input.paidAmount,
        paymentMode: input.paymentMode,
        note: "Purchase के समय भुगतान",
        date: now,
        createdAt: now,
        updatedAt: now,
        createdBy: input.userId,
        status: "active",
      });

      transaction.set(cashRef, {
        type: "cashOut",
        amount: input.paidAmount,
        paymentMode: input.paymentMode,
        referenceId: purchaseRef.id,
        note: `Purchase Payment: ${supplierName}`,
        date: now,
        createdAt: now,
        updatedAt: now,
        createdBy: input.userId,
        status: "active",
      });
    }

    transaction.set(activityRef, {
      userId: input.userId,
      userName: input.userName,
      role: input.role,
      action: "PURCHASE_CREATED",
      module: "Purchase",
      recordId: purchaseRef.id,
      details: `${supplierName} से ₹${subtotal} की खरीद`,
      createdAt: now,
    });
  });

  return purchaseRef.id;
        }
