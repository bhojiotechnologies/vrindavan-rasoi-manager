
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import {
  getAllItems,
  type ItemData,
} from "./itemService";

import {
  createSaleDraft,
  saveSale,
  type SaleDraft,
  type SaleDraftResult,
} from "./saleService";

import InvoicePreview from "./InvoicePreview";

import {
  getCustomers,
  getCustomerAdvanceTransactions,
  calculateAdvanceBalance,
  type CustomerRecord,
} from "./customerService";

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

export default function SalesBilling({
  role,
}: SalesBillingProps) {
  const [items, setItems] = useState<ItemData[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [availableAdvance, setAvailableAdvance] = useState(0);

  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("0");
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [advanceUsed, setAdvanceUsed] = useState("0");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [previewSale, setPreviewSale] =
    useState<SaleDraft | null>(null);

  const [previewResult, setPreviewResult] =
    useState<SaleDraftResult | null>(null);

  const isOwner = role === "owner";

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [itemData, customerData] = await Promise.all([
          getAllItems(),
          getCustomers(),
        ]);

        if (!mounted) return;

        setItems(itemData.filter((item) => item.active));
        setCustomers(customerData);
      } catch (err) {
        if (!mounted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Items और ग्राहक लोड नहीं हो सके।"
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const subtotal = useMemo(
    () =>
      Number(
        cart
          .reduce(
            (total, item) =>
              total + item.rate * item.quantity,
            0
          )
          .toFixed(2)
      ),
    [cart]
  );

  const discountValue = Number(discount);

  const discountLimit = isOwner
    ? subtotal
    : subtotal * 0.05;

  const safeDiscount =
    Number.isFinite(discountValue) && discountValue >= 0
      ? discountValue
      : 0;

  const finalTotal = Math.max(
    0,
    Number((subtotal - safeDiscount).toFixed(2))
  );

  const cash = Number(cashAmount);
  const upi = Number(upiAmount);
  const advance = Number(advanceUsed);

  const safeCash =
    Number.isFinite(cash) && cash >= 0 ? cash : 0;

  const safeUpi =
    Number.isFinite(upi) && upi >= 0 ? upi : 0;

  const safeAdvance =
    Number.isFinite(advance) && advance >= 0
      ? advance
      : 0;

  const totalPaid = Number(
    (safeCash + safeUpi + safeAdvance).toFixed(2)
  );

  const remaining = Number(
    (finalTotal - totalPaid).toFixed(2)
  );

  function addToCart() {
    setError("");

    const item = items.find(
      (entry) => entry.id === selectedItem
    );

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
            ? {
                ...entry,
                quantity: entry.quantity + qty,
              }
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

  function changeQuantity(
    itemId: string,
    value: string
  ) {
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
    setCustomerMobile("");
    setCustomerId("");
    setAvailableAdvance(0);
    setDiscount("0");
    setCashAmount("");
    setUpiAmount("");
    setAdvanceUsed("0");
    setError("");
    setPreviewSale(null);
    setPreviewResult(null);
    setSaving(false);
  }

  async function selectCustomer(id: string) {
    setError("");
    setCustomerId(id);
    setAvailableAdvance(0);
    setAdvanceUsed("0");

    const customer = customers.find(
      (entry) => entry.id === id
    );

    if (!customer) {
      setCustomerName("");
      setCustomerMobile("");
      return;
    }

    setCustomerName(customer.name);
    setCustomerMobile(customer.mobile);

    try {
      const records =
        await getCustomerAdvanceTransactions(id);

      setAvailableAdvance(
        calculateAdvanceBalance(records)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ग्राहक का एडवांस बैलेंस लोड नहीं हुआ।"
      );
    }
  }

  function openInvoicePreview() {
    setError("");

    if (!customerName.trim()) {
      setError("कृपया ग्राहक का नाम दर्ज करें।");
      return;
    }

    if (
      customerMobile &&
      !/^\d{10}$/.test(customerMobile)
    ) {
      setError(
        "ग्राहक का मोबाइल नंबर 10 अंकों का होना चाहिए।"
      );
      return;
    }

    if (cart.length === 0) {
      setError("बिल में कम से कम एक Item जोड़ें।");
      return;
    }

    if (
      !Number.isFinite(discountValue) ||
      discountValue < 0 ||
      discountValue > discountLimit
    ) {
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

    if (safeAdvance > availableAdvance) {
      setError(
        "उपयोग किया गया Advance उपलब्ध बैलेंस से अधिक है।"
      );
      return;
    }

    if (safeAdvance > 0 && !customerId) {
      setError(
        "Advance इस्तेमाल करने के लिए सेव ग्राहक चुनें।"
      );
      return;
    }

    const mode =
      safeCash > 0 && (safeUpi > 0 || safeAdvance > 0)
        ? "split"
        : safeUpi > 0 && safeAdvance > 0
          ? "split"
          : safeAdvance > 0
            ? "advance"
            : safeUpi > 0
              ? "upi"
              : "cash";

    const draft: SaleDraft = {
      customerId: customerId || undefined,
      customerName: customerName.trim(),
      customerMobile: customerMobile.trim(),
      items: cart.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity,
        rate: item.rate,
        unit: item.unit,
      })),
      discount: discountValue,
      cashAmount: safeCash,
      upiAmount: safeUpi,
      advanceAmount: safeAdvance,
      paymentMode: mode,
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

  async function handleSaveSale(): Promise<string> {
    if (!previewSale || saving) {
      throw new Error("बिल सेव करने के लिए उपलब्ध नहीं है।");
    }

    try {
      setSaving(true);
      setError("");

      const saved = await saveSale(previewSale, role);

      return saved.invoiceNumber;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "बिल सेव नहीं हो पाया।";

      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }

  if (previewSale && previewResult) {
    return (
      <InvoicePreview
        sale={previewSale}
        result={previewResult}
        onSave={handleSaveSale}
        onClose={() => {
          setPreviewSale(null);
          setPreviewResult(null);
          setSaving(false);
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

        <label style={styles.label}>
          सेव ग्राहक चुनें (वैकल्पिक)
        </label>

        <select
          style={styles.input}
          value={customerId}
          onChange={(event) =>
            void selectCustomer(event.target.value)
          }
        >
          <option value="">नया / Walk-in ग्राहक</option>

          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name} — {customer.mobile}
            </option>
          ))}
        </select>

        <label style={styles.label}>ग्राहक का नाम</label>

        <input
          style={styles.input}
          type="text"
          value={customerName}
          onChange={(event) => {
            setCustomerName(event.target.value);
            setCustomerId("");
            setAvailableAdvance(0);
            setAdvanceUsed("0");
          }}
          placeholder="ग्राहक का नाम लिखें"
        />

        <label style={styles.label}>मोबाइल नंबर</label>

        <input
          style={styles.input}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={customerMobile}
          onChange={(event) =>
            setCustomerMobile(
              event.target.value
                .replace(/\D/g, "")
                .slice(0, 10)
            )
          }
          placeholder="10 अंकों का मोबाइल"
        />

        {customerId && (
          <p style={styles.note}>
            उपलब्ध एडवांस:{" "}
            <strong>{money(availableAdvance)}</strong>
          </p>
        )}
      </section>

      <section style={styles.card}>
        <h3 style={styles.title}>Item चुनें</h3>

        {loading ? (
          <p>Items लोड हो रहे हैं...</p>
        ) : items.length === 0 ? (
          <p style={styles.empty}>
            कोई Active Item उपलब्ध नहीं है। पहले Item Master
            में Item जोड़ें।
          </p>
        ) : (
          <>
            <label style={styles.label}>Item</label>

            <select
              style={styles.input}
              value={selectedItem}
              onChange={(event) =>
                setSelectedItem(event.target.value)
              }
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
              onChange={(event) =>
                setQuantity(event.target.value)
              }
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
              <article
                key={item.itemId}
                style={styles.cartItem}
              >
                <div style={{ flex: 1 }}>
                  <strong>{item.name}</strong>

                  <p style={styles.itemInfo}>
                    {money(item.rate)} × {item.quantity}{" "}
                    {item.unit}
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
                      changeQuantity(
                        item.itemId,
                        event.target.value
                      )
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
          Discount (₹) —{" "}
          {isOwner ? "Owner" : "Staff अधिकतम 5%"}
        </label>

        <input
          style={styles.input}
          type="number"
          min="0"
          max={discountLimit}
          step="0.01"
          value={discount}
          onChange={(event) =>
            setDiscount(event.target.value)
          }
        />

        <div style={styles.summaryRow}>
          <span>Discount</span>
          <strong>{money(safeDiscount)}</strong>
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
          onChange={(event) =>
            setCashAmount(event.target.value)
          }
          placeholder="0"
        />

        <label style={styles.label}>UPI (₹)</label>

        <input
          style={styles.input}
          type="number"
          min="0"
          step="0.01"
          value={upiAmount}
          onChange={(event) =>
            setUpiAmount(event.target.value)
          }
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
          max={availableAdvance}
          onChange={(event) =>
            setAdvanceUsed(event.target.value)
          }
          disabled={!customerId || availableAdvance <= 0}
        />

        {customerId && (
          <p style={styles.note}>
            उपलब्ध एडवांस से अधिक राशि उपयोग नहीं कर सकते।
            अधिकतम: {money(availableAdvance)}
          </p>
        )}

        <div style={styles.summaryRow}>
          <span>कुल भुगतान</span>
          <strong>{money(totalPaid)}</strong>
        </div>

        <div style={styles.summaryRow}>
          <span>शेष राशि</span>
          <strong
            style={{
              color: remaining === 0 ? "#23733a" : "#b42318",
            }}
          >
            {money(remaining)}
          </strong>
        </div>

        <p style={styles.note}>
          नियम: पूरा भुगतान Cash, UPI और उपलब्ध Advance से ही
          दर्ज होगा। Customer Credit की सुविधा नहीं है।
        </p>
      </section>

      {error && <p style={styles.error}>{error}</p>}

      <button
        style={styles.primaryButton}
        onClick={openInvoicePreview}
        disabled={loading || saving}
      >
        बिल जाँचें और Invoice Preview देखें
      </button>

      <button
        style={styles.resetButton}
        onClick={resetBill}
        disabled={saving}
      >
        नया बिल शुरू करें
      </button>

      <p style={styles.warning}>
        Preview देखने के बाद बिल सेव करें। सेव होने पर
        Invoice Number जारी होगा।
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
    background: "#ead9b7",
    color: "#70451f",
    borderRadius: 20,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 700,
  },
  card: {
    background: "#fffdf8",
    border: "1px solid #e2d3b9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    boxShadow: "0 2px 7px rgba(70,45,20,0.05)",
  },
  title: {
    margin: "0 0 14px",
    fontSize: 18,
    color: "#70451f",
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    margin: "12px 0 6px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #d8c9ad",
    background: "#fff",
    color: "#49321f",
    fontSize: 15,
  },
  primaryButton: {
    width: "100%",
    border: 0,
    borderRadius: 9,
    padding: 14,
    marginTop: 12,
    background: "#805326",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  resetButton: {
    width: "100%",
    border: "1px solid #c7b18e",
    borderRadius: 9,
    padding: 13,
    marginTop: 10,
    background: "#eee3d1",
    color: "#49321f",
    fontWeight: 700,
    fontSize: 14,
  },
  empty: {
    color: "#80694f",
    fontSize: 14,
  },
  note: {
    fontSize: 13,
    color: "#80694f",
    lineHeight: 1.5,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  cartItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #eadfc9",
  },
  itemInfo: {
    margin: "5px 0",
    color: "#80694f",
    fontSize: 13,
  },
  quantityBox: {
    width: 100,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  quantityInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: 7,
    border: "1px solid #d8c9ad",
    borderRadius: 6,
  },
  removeButton: {
    border: 0,
    borderRadius: 6,
    padding: 7,
    background: "#f8e2dc",
    color: "#9d3025",
    fontWeight: 600,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid #eadfc9",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "12px 0 2px",
    fontSize: 19,
    color: "#70451f",
  },
  error: {
    background: "#ffebee",
    color: "#a32020",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  warning: {
    color: "#80694f",
    fontSize: 12,
    lineHeight: 1.5,
    textAlign: "center",
  },
};
