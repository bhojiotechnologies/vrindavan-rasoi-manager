
import {
  collection,
  doc,
  query,
  where,
  runTransaction,
} from "firebase/firestore";

import { db, auth } from "./firebase";
import { COLLECTIONS } from "./schema";
import {
  calculateSubtotal,
  calculateDiscount,
  calculateFinalTotal,
} from "./financeUtils";

export type SalePaymentMode =
  | "cash"
  | "upi"
  | "advance"
  | "split";

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

export interface SavedSaleResult {
  saleId: string;
  invoiceNumber: string;
  createdAt: number;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function validateAmount(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} की राशि सही नहीं है।`);
  }
}

export function validateSaleDraft(
  sale: SaleDraft,
  role: "owner" | "staff"
): SaleDraftResult {
  if (!sale.items || sale.items.length === 0) {
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

  for (const item of sale.items) {
    if (!item.itemId || !item.name.trim()) {
      throw new Error("Item की जानकारी अधूरी है।");
    }

    if (
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new Error("Quantity शून्य से अधिक होनी चाहिए।");
    }

    if (
      !Number.isFinite(item.rate) ||
      item.rate < 0
    ) {
      throw new Error("Item का Rate सही नहीं है।");
    }
  }

  validateAmount(sale.discount, "Discount");
  validateAmount(sale.cashAmount, "Cash");
  validateAmount(sale.upiAmount, "UPI");
  validateAmount(sale.advanceAmount, "Advance");

  if (sale.advanceAmount > 0 && !sale.customerId) {
    throw new Error(
      "Advance इस्तेमाल करने के लिए सेव ग्राहक चुनें।"
    );
  }

  const subtotal = roundMoney(
    calculateSubtotal(
      sale.items.map((item) => ({
        quantity: item.quantity,
        rate: item.rate,
      }))
    )
  );

  if (
    role === "staff" &&
    sale.discount > subtotal * 0.05
  ) {
    throw new Error(
      "Staff अधिकतम 5% Discount दे सकता है।"
    );
  }

  const discount = roundMoney(
    calculateDiscount(subtotal, sale.discount)
  );

  const finalTotal = roundMoney(
    calculateFinalTotal(subtotal, discount)
  );

  const cashAmount = roundMoney(sale.cashAmount);
  const upiAmount = roundMoney(sale.upiAmount);
  const advanceAmount = roundMoney(sale.advanceAmount);

  const paidAmount = roundMoney(
    cashAmount + upiAmount + advanceAmount
  );

  if (paidAmount !== finalTotal) {
    throw new Error(
      `कुल भुगतान ₹${paidAmount.toFixed(2)} है, जबकि बिल ₹${finalTotal.toFixed(2)} का है।`
    );
  }

  return {
    subtotal,
    discount,
    finalTotal,
    cashAmount,
    upiAmount,
    advanceAmount,
    paidAmount,
    balance: roundMoney(finalTotal - paidAmount),
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
 * वास्तविक बिक्री सेव करना।
 * Invoice Counter, Sale और Advance Adjustment
 * एक Firestore Transaction में सेव होते हैं।
 */
export async function saveSale(
  sale: SaleDraft,
  role: "owner" | "staff"
): Promise<SavedSaleResult> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "Login session समाप्त हो गया है। दोबारा Login करें।"
    );
  }

  const result = validateSaleDraft(sale, role);

  const year = new Date().getFullYear();
  const now = Date.now();

  const counterRef = doc(
    db,
    COLLECTIONS.invoiceCounters,
    String(year)
  );

  const saleRef = doc(
    collection(db, COLLECTIONS.sales)
  );

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
    result.advanceAmount > 0
      ? doc(collection(db, COLLECTIONS.advanceTransactions))
      : null;

  return runTransaction(db, async (transaction) => {
    // सभी Reads, Writes से पहले किए जाते हैं।
    const counterSnapshot = await transaction.get(counterRef);

    if (!counterSnapshot.exists() && sale.advanceAmount > 0 && !customerRef) {
      throw new Error("Advance के लिए ग्राहक चुनना जरूरी है।");
    }

    if (customerRef) {
      const customerSnapshot = await transaction.get(customerRef);

      if (!customerSnapshot.exists()) {
        throw new Error("चुना गया ग्राहक उपलब्ध नहीं है।");
      }

      if (customerSnapshot.data().status === "inactive") {
        throw new Error("यह ग्राहक निष्क्रिय है।");
      }
    }

    let availableAdvance = 0;

    if (advanceQuery) {
      const advanceSnapshot = await transaction.get(advanceQuery);

      for (const entry of advanceSnapshot.docs) {
        const data = entry.data();
        const amount = Number(data.amount || 0);

        if (data.status && data.status !== "active") {
          continue;
        }

        if (data.type === "deposit") {
          availableAdvance += amount;
        } else if (
          data.type === "refund" ||
          data.type === "adjustment"
        ) {
          availableAdvance -= amount;
        }
      }
    }

    availableAdvance = roundMoney(
      Math.max(0, availableAdvance)
    );

    if (result.advanceAmount > availableAdvance) {
      throw new Error(
        `उपलब्ध Advance ₹${availableAdvance.toFixed(2)} है।`
      );
    }

    const lastNumber = counterSnapshot.exists()
      ? Number(counterSnapshot.data().lastNumber || 0)
      : 0;

    const nextNumber = lastNumber + 1;

    const invoiceNumber =
      `VR-${year}-${String(nextNumber).padStart(4, "0")}`;

    const savedItems = sale.items.map((item) => ({
      itemId: item.itemId,
      itemName: item.name,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit || "",
      rate: item.rate,
      total: roundMoney(item.quantity * item.rate),
    }));

    const saleData = {
      invoiceNumber,
      customerId: sale.customerId || "",
      customerName: sale.customerName.trim(),
      customerMobile: sale.customerMobile || "",
      items: savedItems,
      subtotal: result.subtotal,
      discount: result.discount,
      total: result.finalTotal,
      cashAmount: result.cashAmount,
      upiAmount: result.upiAmount,
      advanceUsed: result.advanceAmount,
      advanceAmount: result.advanceAmount,
      paidAmount: result.paidAmount,
      balance: result.balance,
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

    if (adjustmentRef && result.advanceAmount > 0) {
      transaction.set(adjustmentRef, {
        customerId: sale.customerId,
        customerName: sale.customerName.trim(),
        type: "adjustment",
        amount: result.advanceAmount,
        paymentMode: "cash",
        saleId: saleRef.id,
        invoiceNumber,
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
      createdAt: now,
    };
  });
}
