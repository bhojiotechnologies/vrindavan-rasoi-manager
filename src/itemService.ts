
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "./firebase";

export interface ItemData {
  id: string;
  name: string;
  category: string;
  unit: string;
  rate: number;
  active: boolean;

  // Inventory fields
  stock?: number;
  lowStockLimit?: number;

  createdAt?: unknown;
  updatedAt?: unknown;
}

const ITEMS_COLLECTION = "items";

function validateItem(item: {
  name: string;
  category: string;
  unit: string;
  rate: number;
  stock?: number;
  lowStockLimit?: number;
}): void {
  if (!item.name.trim()) {
    throw new Error("Item का नाम लिखना जरूरी है।");
  }

  if (!item.category.trim()) {
    throw new Error("Item की Category चुनना जरूरी है।");
  }

  if (!item.unit.trim()) {
    throw new Error("Item की Unit लिखना जरूरी है।");
  }

  if (!Number.isFinite(item.rate) || item.rate < 0) {
    throw new Error("Item की कीमत सही दर्ज करें।");
  }

  if (
    item.stock !== undefined &&
    (!Number.isFinite(item.stock) || item.stock < 0)
  ) {
    throw new Error("Stock की मात्रा सही दर्ज करें।");
  }

  if (
    item.lowStockLimit !== undefined &&
    (!Number.isFinite(item.lowStockLimit) ||
      item.lowStockLimit < 0)
  ) {
    throw new Error("Low Stock Limit सही दर्ज करें।");
  }
}

// सभी Items प्राप्त करें, Active और Inactive दोनों।
export async function getAllItems(): Promise<ItemData[]> {
  const itemsQuery = query(
    collection(db, ITEMS_COLLECTION),
    orderBy("name")
  );

  const snapshot = await getDocs(itemsQuery);

  return snapshot.docs.map((item) => {
    const data = item.data();

    return {
      id: item.id,
      ...(data as Omit<ItemData, "id">),
      stock: Number(data.stock ?? 0),
      lowStockLimit: Number(data.lowStockLimit ?? 5),
    };
  });
}

// नया Item जोड़ें।
export async function addItem(
  item: Omit<ItemData, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  validateItem(item);

  const itemRef = doc(collection(db, ITEMS_COLLECTION));

  await setDoc(itemRef, {
    name: item.name.trim(),
    category: item.category.trim(),
    unit: item.unit.trim(),
    rate: item.rate,
    active: true,

    stock: item.stock ?? 0,
    lowStockLimit: item.lowStockLimit ?? 5,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return itemRef.id;
}

// Item की जानकारी अपडेट करें।
// यह function मौजूदा Stock को नहीं बदलता।
export async function updateItem(
  itemId: string,
  item: Pick<ItemData, "name" | "category" | "unit" | "rate">
): Promise<void> {
  validateItem(item);

  if (!itemId.trim()) {
    throw new Error("Item ID उपलब्ध नहीं है।");
  }

  await updateDoc(doc(db, ITEMS_COLLECTION, itemId), {
    name: item.name.trim(),
    category: item.category.trim(),
    unit: item.unit.trim(),
    rate: item.rate,
    updatedAt: serverTimestamp(),
  });
}

// Item को Delete किए बिना Active/Inactive करें।
export async function setItemStatus(
  itemId: string,
  active: boolean
): Promise<void> {
  if (!itemId.trim()) {
    throw new Error("Item ID उपलब्ध नहीं है।");
  }

  await updateDoc(doc(db, ITEMS_COLLECTION, itemId), {
    active,
    updatedAt: serverTimestamp(),
  });
}
