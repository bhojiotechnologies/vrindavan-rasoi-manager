export function calculateSubtotal(
  items: { quantity: number; rate: number }[]
): number {
  return Number(
    items.reduce(
      (total, item) => total + item.quantity * item.rate,
      0
    ).toFixed(2)
  );
}

export function calculateDiscount(
  subtotal: number,
  discount: number
): number {
  if (
    !Number.isFinite(subtotal) ||
    !Number.isFinite(discount) ||
    subtotal < 0 ||
    discount < 0 ||
    discount > subtotal
  ) {
    throw new Error("Discount या Subtotal की राशि गलत है।");
  }

  return Number(discount.toFixed(2));
}

export function calculateFinalTotal(
  subtotal: number,
  discount: number
): number {
  const validDiscount = calculateDiscount(subtotal, discount);

  return Number((subtotal - validDiscount).toFixed(2));
}

export function calculateRemainingAdvance(
  currentAdvance: number,
  adjustment: number
): number {
  if (
    !Number.isFinite(currentAdvance) ||
    !Number.isFinite(adjustment) ||
    currentAdvance < 0 ||
    adjustment < 0 ||
    adjustment > currentAdvance
  ) {
    throw new Error("Advance की राशि गलत है।");
  }

  return Number((currentAdvance - adjustment).toFixed(2));
}

export function calculateSupplierOutstanding(
  purchaseTotal: number,
  paidAmount: number
): number {
  if (
    !Number.isFinite(purchaseTotal) ||
    !Number.isFinite(paidAmount) ||
    purchaseTotal < 0 ||
    paidAmount < 0 ||
    paidAmount > purchaseTotal
  ) {
    throw new Error("Supplier Payment की राशि गलत है।");
  }

  return Number((purchaseTotal - paidAmount).toFixed(2));
}
