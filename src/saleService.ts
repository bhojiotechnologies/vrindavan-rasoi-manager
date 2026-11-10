import {
  collection,
  doc,
  runTransaction,
  query,
  where,
} from "firebase/firestore";

import { db, auth } from "./firebase";
import { COLLECTIONS } from "./schema";
import {
  calculateSubtotal,
  calculateDiscount,
  calculateFinalTotal,
} from "./financeUtils";

export type SalePaymentMode = "cash" | "upi" | "advance" | "split";

export interface SaleDraftItem {
  itemId: string;
  name: string;
  quantity: number;
  rate: number;
  unit?: string;
}

export interface SaleDraft {
  customerId?: string;
  customerName: string;
  customerMobile?: string;
  items: SaleDraftItem[];
  discount: number;
  cashAmount: number;
  upiAmount: number;
  advanceAmount: number;
  paymentMode: SalePaymentMode;
}

export interface SaleDraftResult {
  subtotal: number;
  discount: number;
  finalTotal: number;
  cashAmount: number;
  upiAmount: number;
  advanceAmount: number;
  paidAmount: number;
  balance: number;
  status: "PAID" | "INVALID";
}

function moneyRound(value: number): number {
  return Number(value.toFixed(2));
}

function validateAmount(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} की राशि सही नहीं है।`);
  }
}

export function validateSaleDraft(
  sale: SaleDraft,
  role: "owner" | "staff"
): SaleDraftResult {
  if (!sale.items.length) {
    throw new Error("बिल में कम से कम एक Item जोड़ें।");
  }

  if (!sale.customerName.trim()) {
    throw new Error("ग्राहक का नाम दर्ज करें।");
  }

  if (
    sale.customerMobile &&
    !/^\d{10}$/.test(sale.customerMobile)
  ) {
    throw new Error("मोबाइल नंबर 10 अंकों का होना चाहिए।");
  }

  sale.items.forEach((item) => {
    if (!item.itemId || !item.name.trim()) {
      throw new Error("Item की जानकारी अधूरी है।");
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error("Quantity शून्य से अधिक होनी चाहिए।");
    }
    if (!Number.isFinite(item.rate) || item.rate < 0) {
      throw new Error("Item Rate सही नहीं है।");
    }
  });

  validateAmount(sale.discount, "Discount");
  validateAmount(sale.cashAmount, "Cash");
  validateAmount(sale.upiAmount, "UPI");
  validateAmount(sale.advanceAmount, "Advance");

  const subtotal = moneyRound(
    calculateSubtotal(
      sale.items.map((item) => ({
        quantity: item.quantity,
        rate: item.rate,
      }))
    )
  );

  if (role === "staff" && sale.discount > subtotal * 0.05) {
    throw new Error("Staff अधिकतम 5% Discount दे सकता है।");
  }

  const discount = moneyRound(
    calculateDiscount(subtotal, sale.discount)
  );
  const finalTotal = moneyRound(
    calculateFinalTotal(subtotal, discount)
  );

  const paidAmount = moneyRound(
    sale.cashAmount + sale.upiAmount + sale.advanceAmount
  );

  if (paidAmount !== finalTotal) {
    throw new Error(
      `कुल भुगतान ₹${paidAmount.toFixed(2)} है, जबकि बिल ₹${finalTotal.toFixed(2)} का है।`
    );
  }

  if (sale.advanceAmount > 0 && !sale.customerId) {
    throw new Error("Advance उपयोग करने के लिए सेव ग्राहक चुनें।");
  }

  return {
    subtotal,
    discount,
    finalTotal,
    cashAmount: moneyRound(sale.cashAmount),
    upiAmount: moneyRound(sale.upiAmount),
    advanceAmount: moneyRound(sale.advanceAmount),
    paidAmount,
    balance: 0,
    status: "PAID",
  };
}

export function createSaleDraft(
  sale: SaleDraft,
  role: "owner" | "staff"
): SaleDraftResult {
  return validateSaleDraft(sale, role);
}

/**
 * वास्तविक बिक्री सेव करता है।
 * Sale, Invoice Counter और Advance Adjustment
 * एक Firestore Transaction में सेव होते हैं।
 */
export async function saveSale(
  sale: SaleDraft,
  role: "owner" | "staff"
): Promise<{ saleId: string; invoiceNumber: string }> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Login session समाप्त हो गया है। दोबारा Login करें।");
  }

  const result = validateSaleDraft(sale, role);
  const now = Date.now();
  const year = new Date().getFullYear();
  const counterId = String(year);

  const counterRef = doc(
    db,
    COLLECTIONS.invoiceCounters,
    counterId
  );

  const saleRef = doc(collection(db, COLLECTIONS.sales));

  const customerRef = sale.customerId
    ? doc(db, COLLECTIONS.customers, sale.customerId)
    : null;

  const advanceQuery = sale.customerId
    ? query(
        collection(db, COLLECTIONS.advanceTransactions),
        where("customerId", "==", sale.customerId)
      )
    : null;

  const adjustmentRef =
    sale.advanceAmount > 0
      ? doc(collection(db, COLLECTIONS.advanceTransactions))
      : null;

  return runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);

    let customerSnap: Awaited<ReturnType<typeof transaction.get>> | null =
      null;

    let advanceSnap: Awaited<ReturnType<typeof transaction.get>> | null =
      null;

    if (customerRef) {
      customerSnap = await transaction.get(customerRef);
      if (!customerSnap.exists()) {
        throw new Error("चुना गया ग्राहक अब उपलब्ध नहीं है।");
      }
    }

    if (advanceQuery) {
      advanceSnap = await transaction.get(advanceQuery);
    }

    const lastNumber = counterSnap.exists()
      ? Number(counterSnap.data().lastNumber || 0)
      : 0;

    const nextNumber = lastNumber + 1;

    const invoiceNumber =
      `VR-${year}-${String(nextNumber).padStart(4, "0")}`;

    let currentAdvance = 0;

    if (advanceSnap) {
      advanceSnap.docs.forEach((entry) => {
        const data = entry.data();
        const amount = Number(data.amount || 0);

        if (data.type === "deposit") currentAdvance += amount;
        if (data.type === "refund") currentAdvance -= amount;
        if (data.type === "adjustment") currentAdvance -= amount;
      });
    }

    currentAdvance = moneyRound(Math.max(0, currentAdvance));

    if (sale.advanceAmount > currentAdvance) {
      throw new Error(
        `उपलब्ध एडवांस ₹${currentAdvance.toFixed(2)} है।`
      );
    }

    const saleItems = sale.items.map((item) => ({
      itemId: item.itemId,
      itemName: item.name,
      quantity: item.quantity,
      unit: item.unit || "",
      rate: item.rate,
      total: moneyRound(item.quantity * item.rate),
    }));

    const saleData = {
      invoiceNumber,
      customerId: sale.customerId || "",
      customerName: sale.customerName.trim(),
      customerMobile: sale.customerMobile || "",
      items: saleItems,
      subtotal: result.subtotal,
      discount: result.discount,
      total: result.finalTotal,
      cashAmount: result.cashAmount,
      upiAmount: result.upiAmount,
      advanceUsed: result.advanceAmount,
      paymentMode: sale.paymentMode,
      createdBy: user.uid,
      createdAt: now,
      status: "active",
    };

    transaction.set(saleRef, saleData);

    transaction.set(counterRef, {
      year,
      lastNumber: nextNumber,
      updatedAt: now,
      updatedBy: user.uid,
    });

    if (adjustmentRef && sale.customerId) {
      transaction.set(adjustmentRef, {
        customerId: sale.customerId,
        customerName: sale.customerName,
        type: "adjustment",
        amount: result.advanceAmount,
        paymentMode: "cash",
        saleId: saleRef.id,
        note: `Invoice ${invoiceNumber} में Advance समायोजन`,
        date: now,
        createdAt: now,
        createdBy: user.uid,
        status: "active",
      });
    }

    return {
      saleId: saleRef.id,
      invoiceNumber,
    };
  });
}
