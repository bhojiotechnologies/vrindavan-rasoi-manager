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

function validateAmount(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} की राशि सही नहीं है।`);
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
  if (sale.customerMobile && !/^\d{10}$/.test(sale.customerMobile)) {
    throw new Error("ग्राहक का मोबाइल नंबर 10 अंकों का होना चाहिए।");
  }

  for (const item of sale.items) {
    if (!item.itemId.trim() || !item.name.trim()) {
      throw new Error("बिल में किसी Item की जानकारी अधूरी है।");
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error("Item की Quantity शून्य से अधिक होनी चाहिए।");
    }

    if (!Number.isFinite(item.rate) || item.rate < 0) {
      throw new Error("Item का Rate सही नहीं है।");
    }
  }

  validateAmount(sale.discount, "Discount");
  validateAmount(sale.cashAmount, "Cash");
  validateAmount(sale.upiAmount, "UPI");
  validateAmount(sale.advanceAmount, "Advance");
  if (sale.paymentMode === "split" && sale.cashAmount + sale.upiAmount + sale.advanceAmount <= 0) {
    throw new Error("भुगतान की राशि दर्ज करें।");
  }

  const subtotal = calculateSubtotal(
    sale.items.map((item) => ({
      quantity: item.quantity,
      rate: item.rate,
    }))
  );

  if (role === "staff" && sale.discount > subtotal * 0.05) {
    throw new Error("Staff अधिकतम 5% Discount दे सकता है।");
  }

  const discount = calculateDiscount(subtotal, sale.discount);
  const finalTotal = calculateFinalTotal(subtotal, discount);

  const paidAmount = Number(
    (
      sale.cashAmount +
      sale.upiAmount +
      sale.advanceAmount
    ).toFixed(2)
  );

  if (paidAmount !== finalTotal) {
    throw new Error(
      `भुगतान की राशि ₹${paidAmount.toFixed(2)} है, जबकि बिल ₹${finalTotal.toFixed(2)} का है।`
    );
  }

  return {
    subtotal,
    discount,
    finalTotal,
    cashAmount: sale.cashAmount,
    upiAmount: sale.upiAmount,
    advanceAmount: sale.advanceAmount,
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
