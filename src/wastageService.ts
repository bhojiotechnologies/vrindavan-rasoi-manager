
import {
  collection,
  doc,
  runTransaction,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  COLLECTIONS,
  type UserRole,
} from "./schema";

interface WastageInput {
  itemId: string;
  quantity: number;
  reason: string;
  estimatedLoss: number;
  photoUrl?: string;
  date?: number;
  userId: string;
  userName: string;
  role: UserRole;
}

export async function createWastage(
  input: WastageInput
): Promise<string> {
  if (!input.itemId.trim() || !input.reason.trim()) {
    throw new Error("Item और Wastage का कारण जरूरी है।");
  }

  if (!input.userId.trim() || !input.userName.trim()) {
    throw new Error("Login User की जानकारी उपलब्ध नहीं है।");
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Wastage Quantity सही दर्ज करें।");
  }

  if (
    !Number.isFinite(input.estimatedLoss) ||
    input.estimatedLoss < 0
  ) {
    throw new Error("Estimated Loss सही दर्ज करें।");
  }

  const itemRef = doc(db, COLLECTIONS.items, input.itemId);
  const wastageRef = doc(collection(db, COLLECTIONS.wastage));
  const movementRef = doc(collection(db, COLLECTIONS.stockMovements));
  const activityRef = doc(collection(db, COLLECTIONS.activityLogs));

  const now = input.date ?? Date.now();

  await runTransaction(db, async (transaction) => {
    const itemSnapshot = await transaction.get(itemRef);

    if (!itemSnapshot.exists()) {
      throw new Error("यह Item उपलब्ध नहीं है।");
    }

    const item = itemSnapshot.data();
    const previousStock = Number(item.stock ?? 0);

    if (!Number.isFinite(previousStock) || previousStock < 0) {
      throw new Error("Item का मौजूदा Stock सही नहीं है।");
    }

    if (input.quantity > previousStock) {
      throw new Error(
        `Wastage Quantity उपलब्ध Stock से अधिक है। Stock: ${previousStock}`
      );
    }

    const newStock = Number(
      (previousStock - input.quantity).toFixed(3)
    );

    const itemName = String(item.name ?? "");

    transaction.update(itemRef, {
      stock: newStock,
      updatedAt: now,
    });

    transaction.set(wastageRef, {
      itemId: input.itemId,
      itemName,
      quantity: input.quantity,
      estimatedLoss: Number(input.estimatedLoss.toFixed(2)),
      reason: input.reason.trim(),
      photoUrl: input.photoUrl ?? "",
      date: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      status: "active",
    });

    transaction.set(movementRef, {
      itemId: input.itemId,
      itemName,
      type: "wastage",
      quantity: input.quantity,
      previousStock,
      newStock,
      referenceId: wastageRef.id,
      note: input.reason.trim(),
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      status: "active",
    });

    transaction.set(activityRef, {
      userId: input.userId,
      userName: input.userName,
      role: input.role,
      action: "WASTAGE_CREATED",
      module: "Inventory",
      recordId: wastageRef.id,
      details:
        `${itemName}: ${input.quantity} ${String(item.unit ?? "")} Wastage`,
      createdAt: now,
    });
  });

  return wastageRef.id;
}
