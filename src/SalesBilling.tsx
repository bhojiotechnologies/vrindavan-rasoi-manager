import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import {
  getAllItems,
  type ItemData,
} from "./itemService";

import {
  createSaleDraft,
  type SaleDraft,
  type SaleDraftResult,
} from "./saleService";

import InvoicePreview from "./InvoicePreview";

interface SalesBillingProps {
  role: "owner" | "staff";
}

interface CartItem {
  itemId: string;
  name: string;
  unit: string;
  rate: number;
  quantity: number;
}

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

export default function SalesBilling({ role }: SalesBillingProps) {
  const [items, setItems] = useState<ItemData[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("0");
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [advanceUsed, setAdvanceUsed] = useState("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewSale, setPreviewSale] = useState<SaleDraft | null>(null);
  const [previewResult, setPreviewResult] =
    useState<SaleDraftResult | null>(null);

  const isOwner = role === "owner";

  useEffect(() => {
    async function loadItems() {
      try {
        setLoading(true);
        setError("");

        const data = await getAllItems();
        setItems(data.filter((item) => item.active));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Items लोड नहीं हो सके।"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadItems();
  }, []);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + item.rate * item.quantity,
        0
      ),
    [cart]
  );

  const discountValue = Number(discount);
  const discountLimit = isOwner ? subtotal : subtotal * 0.05;

  const finalTotal = Math.max(
    0,
    subtotal - (Number.isFinite(discountValue) ? discountValue : 0)
  );

  const cash = Number(cashAmount);
  const upi = Number(upiAmount);
  const advance = Number(advanceUsed);

  const safeCash = Number.isFinite(cash) ? cash : 0;
  const safeUpi = Number.isFinite(upi) ? upi : 0;
  const safeAdvance = Number.isFinite(advance) ? advance : 0;

  function addToCart() {
    setError("");

    const item = items.find((entry) => entry.id === selectedItem);
    const qty = Number(quantity);

    if (!item) {
      setError("कृपया पहले Item चुनें।");
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity शून्य से अधिक होनी चाहिए।");
      return;
    }

    setCart((previous) => {
      const existing = previous.find(
        (entry) => entry.itemId === item.id
      );

      if (existing) {
        return previous.map((entry) =>
          entry.itemId === item.id
            ? { ...entry, quantity: entry.quantity + qty }
            : entry
        );
      }

      return [
        ...previous,
        {
          itemId: item.id,
          name: item.name,
          unit: item.unit,
          rate: item.rate,
          quantity: qty,
        },
      ];
    });

    setSelectedItem("");
    setQuantity("1");
  }

  function changeQuantity(itemId: string, value: string) {
    const qty = Number(value);

    if (!Number.isFinite(qty) || qty <= 0) {
      return;
    }

    setCart((previous) =>
      previous.map((item) =>
        item.itemId === itemId
          ? { ...item, quantity: qty }
          : item
      )
    );
  }

  function removeItem(itemId: string) {
    setCart((previous) =>
      previous.filter((item) => item.itemId !== itemId)
    );
  }

  function resetBill() {
    setCart([]);
    setCustomerName("");
    setDiscount("0");
    setCashAmount("");
    setUpiAmount("");
    setAdvanceUsed("0");
    setError("");
    setPreviewSale(null);
    setPreviewResult(null);
  }

  function openInvoicePreview() {
    setError("");

    if (!customerName.trim()) {
      setError("कृपया ग्राहक का नाम दर्ज करें।");
      return;
    }

    if (cart.length === 0) {
      setError("बिल में कम से कम एक Item जोड़ें।");
      return;
    }

    if (!Number.isFinite(discountValue) || discountValue < 0) {
      setError("Discount की राशि सही दर्ज करें।");
      return;
    }

    if (discountValue > discountLimit) {
      setError(
        isOwner
          ? "Discount कुल राशि से अधिक नहीं हो सकता।"
          : "Staff अधिकतम 5% Discount दे सकता है।"
      );
      return;
    }

    if (
      !Number.isFinite(cash) ||
      !Number.isFinite(upi) ||
      !Number.isFinite(advance) ||
      cash < 0 ||
      upi < 0 ||
      advance < 0
    ) {
      setError("भुगतान की राशि सही दर्ज करें।");
      return;
    }

    const draft: SaleDraft = {
      customerName: customerName.trim(),
      items: cart.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity,
        rate: item.rate,
      })),
      discount: discountValue,
      cashAmount: cash,
      upiAmount: upi,
      advanceAmount: advance,
      paymentMode: "cash",
    };

    try {
      const result = createSaleDraft(draft, role);

      setPreviewSale(draft);
      setPreviewResult(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "बिल की जाँच नहीं हो सकी।"
      );
    }
  }

  if (previewSale && previewResult) {
    return (
      <InvoicePreview
        sale={previewSale}
        result={previewResult}
        onClose={() => {
          setPreviewSale(null);
          setPreviewResult(null);
        }}
      />
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.heading}>Sales & Billing</h2>
          <p style={styles.subtitle}>वृंदावन रसोई</p>
        </div>

        <span style={styles.role}>
          {isOwner ? "OWNER" : "STAFF"}
        </span>
      </header>

      <section style={styles.card}>
        <h3 style={styles.title}>ग्राहक की जानकारी</h3>

        <label style={styles.label}>ग्राहक का नाम</label>

        <input
          style={styles.input}
          type="text"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          placeholder="ग्राहक का नाम लिखें"
        />
      </section>

      <section style={styles.card}>
        <h3 style={styles.title}>Item चुनें</h3>

        {loading ? (
          <p>Items लोड हो रहे हैं...</p>
        ) : items.length === 0 ? (
          <p style={styles.empty}>
            कोई Active Item उपलब्ध नहीं है। पहले Item Master में Item जोड़ें।
          </p>
        ) : (
          <>
            <label style={styles.label}>Item</label>

            <select
              style={styles.input}
              value={selectedItem}
              onChange={(event) => setSelectedItem(event.target.value)}
            >
              <option value="">Item चुनें</option>

              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {money(item.rate)} / {item.unit}
                </option>
              ))}
            </select>

            <label style={styles.label}>Quantity</label>

            <input
              style={styles.input}
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />

            <button
              style={styles.primaryButton}
              onClick={addToCart}
            >
              + बिल में जोड़ें
            </button>
          </>
        )}
      </section>

      <section style={styles.card}>
        <h3 style={styles.title}>बिल के Items</h3>

        {cart.length === 0 ? (
          <p style={styles.empty}>अभी बिल खाली है।</p>
        ) : (
          <div style={styles.list}>
            {cart.map((item) => (
              <article key={item.itemId} style={styles.cartItem}>
                <div style={{ flex: 1 }}>
                  <strong>{item.name}</strong>

                  <p style={styles.itemInfo}>
                    {money(item.rate)} × {item.quantity} {item.unit}
                  </p>

                  <strong>
                    {money(item.rate * item.quantity)}
                  </strong>
                </div>

                <div style={styles.quantityBox}>
                  <input
                    aria-label={`${item.name} Quantity`}
                    style={styles.quantityInput}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) =>
                      changeQuantity(item.itemId, event.target.value)
                    }
                  />

                  <button
                    style={styles.removeButton}
                    onClick={() => removeItem(item.itemId)}
                  >
                    हटाएँ
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h3 style={styles.title}>बिल का हिसाब</h3>

        <div style={styles.summaryRow}>
          <span>Subtotal</span>
          <strong>{money(subtotal)}</strong>
        </div>

        <label style={styles.label}>
          Discount (₹) — {isOwner ? "Owner" : "Staff अधिकतम 5%"}
        </label>

        <input
          style={styles.input}
          type="number"
          min="0"
          max={discountLimit}
          step="0.01"
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
        />

        <div style={styles.summaryRow}>
          <span>Discount</span>
          <strong>
            {money(Number.isFinite(discountValue) ? discountValue : 0)}
          </strong>
        </div>

        <div style={styles.totalRow}>
          <span>Final Total</span>
          <strong>{money(finalTotal)}</strong>
        </div>
      </section>

      <section style={styles.card}>
        <h3 style={styles.title}>भुगतान का विवरण</h3>

        <label style={styles.label}>Cash (₹)</label>

        <input
          style={styles.input}
          type="number"
          min="0"
          step="0.01"
          value={cashAmount}
          onChange={(event) => setCashAmount(event.target.value)}
          placeholder="0"
        />

        <label style={styles.label}>UPI (₹)</label>

        <input
          style={styles.input}
          type="number"
          min="0"
          step="0.01"
          value={upiAmount}
          onChange={(event) => setUpiAmount(event.target.value)}
          placeholder="0"
        />

        <label style={styles.label}>
          Customer Advance इस्तेमाल (₹)
        </label>

        <input
          style={styles.input}
          type="number"
          min="0"
          step="0.01"
          value={advanceUsed}
          onChange={(event) => setAdvanceUsed(event.target.value)}
        />

        <div style={styles.summaryRow}>
          <span>कुल भुगतान</span>
          <strong>
            {money(safeCash + safeUpi + safeAdvance)}
          </strong>
        </div>

        <div style={styles.summaryRow}>
          <span>शेष राशि</span>
          <strong>
            {money(finalTotal - safeCash - safeUpi - safeAdvance)}
          </strong>
        </div>

        <p style={styles.note}>
          नियम: इस बिल में पूरा भुगतान Cash, UPI और उपलब्ध Advance से ही
          दर्ज होगा। Customer Credit की सुविधा नहीं है।
        </p>
      </section>

      {error && <p style={styles.error}>{error}</p>}

      <button
        style={styles.primaryButton}
        onClick={openInvoicePreview}
      >
        बिल जाँचें और Invoice Preview देखें
      </button>

      <button
        style={styles.resetButton}
        onClick={resetBill}
      >
        नया बिल शुरू करें
      </button>

      <p style={styles.warning}>
        अभी यह केवल Billing Draft Preview है। वास्तविक Invoice Number,
        Sale Save, Advance Adjustment और Stock Update सक्रिय नहीं हैं।
      </p>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    padding: 16,
    background: "#f8f3e8",
    minHeight: "100vh",
    color: "#49321f",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  heading: {
    margin: 0,
    fontSize: 24,
  },

  subtitle: {
    margin: "5px 0",
    color: "#80694f",
  },

  role: {
    background: "#ead9b5",
    padding: "8px 12px",
    borderRadius: 20,
    fontWeight: 700,
    fontSize: 12,
  },

  card: {
    background: "#fffdf8",
    padding: 16,
    borderRadius: 14,
    marginBottom: 15,
    border: "1px solid #e5d6b8",
  },

  title: {
    marginTop: 0,
    color: "#67451f",
  },

  label: {
    display: "block",
    marginTop: 13,
    marginBottom: 6,
    fontWeight: 600,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    border: "1px solid #d8c6a5",
    borderRadius: 8,
    background: "#fff",
    fontSize: 16,
  },

  primaryButton: {
    width: "100%",
    marginTop: 15,
    background: "#79552e",
    color: "#fff",
    border: 0,
    borderRadius: 9,
    padding: 13,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },

  resetButton: {
    width: "100%",
    marginTop: 10,
    background: "#eadfc9",
    color: "#49321f",
    border: 0,
    borderRadius: 9,
    padding: 12,
    fontWeight: 600,
    cursor: "pointer",
  },

  list: {
    display: "grid",
    gap: 10,
  },

  cartItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "12px 0",
    borderBottom: "1px solid #eadfc9",
  },

  itemInfo: {
    margin: "5px 0",
    color: "#80694f",
    fontSize: 13,
  },

  quantityBox: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    width: 85,
  },

  quantityInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: 8,
    border: "1px solid #d8c6a5",
    borderRadius: 7,
  },

  removeButton: {
    background: "#f4e5df",
    color: "#963d2d",
    border: 0,
    padding: 7,
    borderRadius: 7,
    cursor: "pointer",
  },

  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "9px 0",
  },

  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    borderTop: "1px solid #d8c6a5",
    marginTop: 10,
    paddingTop: 14,
    fontSize: 20,
    fontWeight: 800,
    color: "#67451f",
  },

  note: {
    background: "#f2e8d5",
    padding: 11,
    borderRadius: 9,
    fontSize: 12,
    lineHeight: 1.6,
    color: "#70542f",
  },

  empty: {
    color: "#80694f",
    lineHeight: 1.6,
  },

  error: {
    color: "#b42318",
    background: "#fce8e6",
    padding: 12,
    borderRadius: 8,
    fontWeight: 600,
  },

  warning: {
    color: "#80694f",
    fontSize: 12,
    lineHeight: 1.6,
    marginTop: 15,
  },
};
