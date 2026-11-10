
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

export interface PurchaseInput {
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

export interface PurchaseEditInput {
  purchaseId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    rate: number;
  }>;
  invoiceNumber?: string;
  userId: string;
  userName: string;
  role: UserRole;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function validateItems(
  items: Array<{
    itemId: string;
    quantity: number;
    rate: number;
  }>
): void {
  if (!items.length) {
    throw new Error("कम से कम एक Item जोड़ें।");
  }

  items.forEach((item) => {
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
}

function groupItems(
  items: Array<{
    itemId: string;
    quantity: number;
    rate: number;
  }>
) {
  const groups = new Map<
    string,
    { quantity: number; rate: number }
  >();

  items.forEach((item) => {
    const existing = groups.get(item.itemId);

    if (existing) {
      if (existing.rate !== item.rate) {
        throw new Error(
          "एक ही Purchase में एक Item की अलग-अलग Rate दर्ज न करें।"
        );
      }

      existing.quantity += item.quantity;
    } else {
      groups.set(item.itemId, {
        quantity: item.quantity,
        rate: item.rate,
      });
    }
  });

  return groups;
}

// =========================================
// CREATE PURCHASE
// =========================================

export async function createPurchase(
  input: PurchaseInput
): Promise<string> {
  if (!input.supplierId.trim() || !input.userId.trim()) {
    throw new Error("Supplier या User की जानकारी उपलब्ध नहीं है।");
  }

  if (!input.userName.trim()) {
    throw new Error("User का नाम उपलब्ध नहीं है।");
  }

  validateItems(input.items);

  if (
    !Number.isFinite(input.paidAmount) ||
    input.paidAmount < 0
  ) {
    throw new Error("Paid Amount सही दर्ज करें।");
  }

  const purchaseRef = doc(
    collection(db, COLLECTIONS.purchases)
  );

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

  const itemGroups = groupItems(input.items);

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
    }> = [];

    itemSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) {
        throw new Error("Purchase का कोई Item उपलब्ध नहीं है।");
      }

      const itemData = snapshot.data();
      const itemId = snapshot.id;
      const group = itemGroups.get(itemId)!;

      if (itemData.active === false) {
        throw new Error(`${String(itemData.name)} Inactive है।`);
      }

      const previousStock = Number(itemData.stock ?? 0);

      if (!Number.isFinite(previousStock) || previousStock < 0) {
        throw new Error("Item का मौजूदा Stock सही नहीं है।");
      }

      const newStock = round3(previousStock + group.quantity);

      const itemName = String(itemData.name ?? "");
      const unit = String(itemData.unit ?? "");
      const lineTotal = round2(group.quantity * group.rate);

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
      });
    });

    subtotal = round2(subtotal);

    if (input.paidAmount > subtotal) {
      throw new Error(
        "Paid Amount Purchase Total से अधिक नहीं हो सकता।"
      );
    }

    const outstanding = round2(subtotal - input.paidAmount);
    const now = input.date ?? Date.now();

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
      totalPurchases: round2(
        Number(supplier.totalPurchases ?? 0) + subtotal
      ),
      totalPaid: round2(
        Number(supplier.totalPaid ?? 0) + input.paidAmount
      ),
      outstandingBalance: round2(
        Number(supplier.outstandingBalance ?? 0) + outstanding
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

// =========================================
// UPDATE EXISTING PURCHASE
// Owner only through Firestore Rules
// =========================================

export async function updatePurchase(
  input: PurchaseEditInput
): Promise<void> {
  if (
    !input.purchaseId.trim() ||
    !input.userId.trim() ||
    !input.userName.trim()
  ) {
    throw new Error("Purchase या User की जानकारी उपलब्ध नहीं है।");
  }

  if (input.role !== "owner") {
    throw new Error("पुरानी Purchase केवल Owner Edit कर सकता है।");
  }

  validateItems(input.items);

  const purchaseRef = doc(
    db,
    COLLECTIONS.purchases,
    input.purchaseId
  );

  const activityRef = doc(
    collection(db, COLLECTIONS.activityLogs)
  );

  const newGroups = groupItems(input.items);

  await runTransaction(db, async (transaction) => {
    const purchaseSnapshot = await transaction.get(purchaseRef);

    if (!purchaseSnapshot.exists()) {
      throw new Error("Purchase रिकॉर्ड नहीं मिला।");
    }

    const oldPurchase = purchaseSnapshot.data();

    if (oldPurchase.status !== "active") {
      throw new Error("यह Purchase Active नहीं है।");
    }

    const supplierId = String(oldPurchase.supplierId ?? "");

    if (!supplierId) {
      throw new Error("Purchase में Supplier ID नहीं मिली।");
    }

    const supplierRef = doc(
      db,
      COLLECTIONS.suppliers,
      supplierId
    );

    const supplierSnapshot = await transaction.get(supplierRef);

    if (!supplierSnapshot.exists()) {
      throw new Error("Purchase का Supplier नहीं मिला।");
    }

    const oldItems = Array.isArray(oldPurchase.items)
      ? (oldPurchase.items as PurchaseItem[])
      : [];

    if (!oldItems.length) {
      throw new Error("पुरानी Purchase में Item विवरण नहीं मिले।");
    }

    const oldGroups = new Map<string, number>();

    oldItems.forEach((item) => {
      oldGroups.set(
        item.itemId,
        (oldGroups.get(item.itemId) ?? 0) + Number(item.quantity)
      );
    });

    const allItemIds = Array.from(
      new Set([
        ...oldGroups.keys(),
        ...newGroups.keys(),
      ])
    );

    const itemRefs = allItemIds.map((id) =>
      doc(db, COLLECTIONS.items, id)
    );

    // सभी Item Reads, किसी Write से पहले।
    const itemSnapshots = await Promise.all(
      itemRefs.map((ref) => transaction.get(ref))
    );

    const itemDataById = new Map<
      string,
      {
        name: string;
        unit: string;
        stock: number;
        active: boolean;
      }
    >();

    itemSnapshots.forEach((snapshot) => {
      if (!snapshot.exists()) {
        throw new Error(
          `Item उपलब्ध नहीं है: ${snapshot.id}`
        );
      }

      const data = snapshot.data();

      itemDataById.set(snapshot.id, {
        name: String(data.name ?? ""),
        unit: String(data.unit ?? ""),
        stock: Number(data.stock ?? 0),
        active: data.active !== false,
      });
    });

    const paidAmount = Number(oldPurchase.paidAmount ?? 0);

    let newSubtotal = 0;

    const newPurchaseItems: PurchaseItem[] = [];

    newGroups.forEach((group, itemId) => {
      const itemData = itemDataById.get(itemId);

      if (!itemData) {
        throw new Error("नया Item उपलब्ध नहीं है।");
      }

      if (!itemData.active) {
        throw new Error(
          `${itemData.name} Inactive है।`
        );
      }

      const total = round2(group.quantity * group.rate);

      newSubtotal += total;

      newPurchaseItems.push({
        itemId,
        itemName: itemData.name,
        quantity: group.quantity,
        unit: itemData.unit,
        rate: group.rate,
        total,
      });
    });

    newSubtotal = round2(newSubtotal);

    if (paidAmount > newSubtotal) {
      throw new Error(
        "नई Purchase Total पहले से किए गए भुगतान से कम नहीं हो सकती।"
      );
    }

    const newOutstanding = round2(
      newSubtotal - paidAmount
    );

    const oldTotal = Number(
      oldPurchase.total ?? oldPurchase.subtotal ?? 0
    );

    const oldOutstanding = Number(
      oldPurchase.outstandingAmount ?? 0
    );

    const supplier = supplierSnapshot.data();

    const newSupplierPurchases = round2(
      Number(supplier.totalPurchases ?? 0) +
      (newSubtotal - oldTotal)
    );

    const newSupplierOutstanding = round2(
      Number(supplier.outstandingBalance ?? 0) +
      (newOutstanding - oldOutstanding)
    );

    if (
      newSupplierPurchases < 0 ||
      newSupplierOutstanding < 0
    ) {
      throw new Error(
        "Supplier Balance में असंगति है। Purchase Edit रोक दी गई।"
      );
    }

    const now = Date.now();

    const movementUpdates: Array<{
      ref: ReturnType<typeof doc>;
      movementRef: ReturnType<typeof doc>;
      itemId: string;
      itemName: string;
      quantity: number;
      previousStock: number;
      newStock: number;
    }> = [];

    allItemIds.forEach((itemId) => {
      const itemData = itemDataById.get(itemId)!;
      const previousStock = itemData.stock;

      const oldQuantity = oldGroups.get(itemId) ?? 0;
      const newQuantity =
        newGroups.get(itemId)?.quantity ?? 0;

      const difference = round3(
        newQuantity - oldQuantity
      );

      if (difference === 0) return;

      if (
        !Number.isFinite(previousStock) ||
        previousStock < 0
      ) {
        throw new Error(
          `${itemData.name} का मौजूदा Stock सही नहीं है।`
        );
      }

      const newStock = round3(
        previousStock + difference
      );

      if (newStock < 0) {
        throw new Error(
          `${itemData.name} का Stock कम है। इस Purchase को घटाया नहीं जा सकता।`
        );
      }

      movementUpdates.push({
        ref: doc(db, COLLECTIONS.items, itemId),
        movementRef: doc(
          collection(db, COLLECTIONS.stockMovements)
        ),
        itemId,
        itemName: itemData.name,
        quantity: Math.abs(difference),
        previousStock,
        newStock,
      });
    });

    // Purchase Update
    transaction.update(purchaseRef, {
      items: newPurchaseItems,
      subtotal: newSubtotal,
      total: newSubtotal,
      outstandingAmount: newOutstanding,
      invoiceNumber:
        input.invoiceNumber?.trim() ??
        String(oldPurchase.invoiceNumber ?? ""),
      updatedAt: now,
      updatedBy: input.userId,
    });

    // Supplier Financial Summary Update
    transaction.update(supplierRef, {
      totalPurchases: newSupplierPurchases,
      outstandingBalance: newSupplierOutstanding,
      updatedAt: now,
      updatedBy: input.userId,
    });

    // Stock and Stock Movement Update
    movementUpdates.forEach((movement) => {
      transaction.update(movement.ref, {
        stock: movement.newStock,
        updatedAt: now,
        updatedBy: input.userId,
      });

      transaction.set(movement.movementRef, {
        itemId: movement.itemId,
        itemName: movement.itemName,
        type: "adjustment",
        quantity: movement.quantity,
        previousStock: movement.previousStock,
        newStock: movement.newStock,
        referenceId: input.purchaseId,
        note: "Purchase Edit के कारण Stock Adjustment",
        createdAt: now,
        updatedAt: now,
        createdBy: input.userId,
        status: "active",
      });
    });

    transaction.set(activityRef, {
      userId: input.userId,
      userName: input.userName,
      role: input.role,
      action: "PURCHASE_UPDATED",
      module: "Purchase",
      recordId: input.purchaseId,
      details:
        `Purchase Edit: ${String(oldPurchase.supplierName ?? "")}, ` +
        `पुराना Total ₹${oldTotal}, नया Total ₹${newSubtotal}`,
      createdAt: now,
    });
  });
    }
