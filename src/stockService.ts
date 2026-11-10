
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";
import { COLLECTIONS, type UserRole } from "./schema";

export type StockMovementType =
  | "purchase"
  | "sale"
  | "wastage"
  | "adjustment";

export interface StockMovementInput {
  itemId: string;
  type: StockMovementType;

  // Purchase, sale और wastage में quantity हमेशा positive होगी।
  // Adjustment में positive = Stock बढ़ेगा, negative = Stock घटेगा।
  quantity: number;

  userId: string;
  userName: string;
  role: UserRole;

  referenceId?: string;
  note?: string;
}

export interface StockMovementResult {
  movementId: string;
  previousStock: number;
  newStock: number;
}

export async function recordStockMovement(
  input: StockMovementInput
): Promise<StockMovementResult> {
  if (!input.itemId.trim()) {
    throw new Error("Item ID उपलब्ध नहीं है।");
  }

  if (!input.userId.trim() || !input.userName.trim()) {
    throw new Error("Login User की जानकारी उपलब्ध नहीं है।");
  }

  if (!Number.isFinite(input.quantity) || input.quantity === 0) {
    throw new Error("Stock की मात्रा शून्य नहीं हो सकती।");
  }

  if (
    input.type !== "adjustment" &&
    input.quantity < 0
  ) {
    throw new Error("Quantity सकारात्मक संख्या में दर्ज करें।");
  }

  if (input.type === "adjustment" && input.role !== "owner") {
    throw new Error("Stock Adjustment केवल Owner कर सकता है।");
  }

  const itemRef = doc(db, COLLECTIONS.items, input.itemId);
  const movementRef = doc(collection(db, COLLECTIONS.stockMovements));
  const activityRef = doc(collection(db, COLLECTIONS.activityLogs));

  return runTransaction(db, async (transaction) => {
    // Transaction में सभी Reads पहले किए जाते हैं।
    const itemSnapshot = await transaction.get(itemRef);

    if (!itemSnapshot.exists()) {
      throw new Error("यह Item उपलब्ध नहीं है।");
    }

    const itemData = itemSnapshot.data();
    const previousStock = Number(itemData.stock ?? 0);

    if (!Number.isFinite(previousStock) || previousStock < 0) {
      throw new Error("Item का मौजूदा Stock सही नहीं है।");
    }

    let stockChange = input.quantity;

    if (input.type === "sale" || input.type === "wastage") {
      stockChange = -input.quantity;
    }

    const newStock = Number(
      (previousStock + stockChange).toFixed(3)
    );

    if (newStock < 0) {
      throw new Error(
        `पर्याप्त Stock उपलब्ध नहीं है। वर्तमान Stock: ${previousStock}`
      );
    }

    const now = Date.now();

    transaction.update(itemRef, {
      stock: newStock,
      updatedAt: serverTimestamp(),
    });

    transaction.set(movementRef, {
      itemId: input.itemId,
      itemName: String(itemData.name ?? ""),
      type: input.type,
      quantity: input.quantity,
      previousStock,
      newStock,
      referenceId: input.referenceId ?? "",
      note: input.note?.trim() ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.userId,
      status: "active",
    });

    transaction.set(activityRef, {
      userId: input.userId,
      userName: input.userName,
      role: input.role,
      action: "STOCK_MOVEMENT",
      module: "Inventory",
      recordId: movementRef.id,
      details:
        `${String(itemData.name ?? "Item")}: ` +
        `${previousStock} → ${newStock} (${input.type})`,
      createdAt: now,
    });

    return {
      movementId: movementRef.id,
      previousStock,
      newStock,
    };
  });
}
