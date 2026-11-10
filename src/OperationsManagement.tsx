import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { auth } from "./firebase";
import { getAllItems, type ItemData } from "./itemService";
import {
  addSupplier,
  getSuppliers,
  recordSupplierPayment,
  type SupplierRecord,
} from "./supplierService";
import { createPurchase } from "./purchaseService";
import { createExpense } from "./expenseService";
import { createWastage } from "./wastageService";
import type { PaymentMode, UserRole } from "./schema";

type Tab =
  | "suppliers"
  | "purchase"
  | "inventory"
  | "expenses"
  | "wastage";

interface Props {
  role: UserRole;
  initialTab?: Tab;
}

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const styles: Record<string, React.CSSProperties> = {
  page: {
    color: "#402b20",
    background: "#fffaf0",
    border: "1px solid #eadcc3",
    borderRadius: 18,
    padding: 14,
  },
  heading: {
    fontSize: 21,
    fontWeight: 800,
    margin: "4px 0 6px",
  },
  subtitle: {
    color: "#806c58",
    fontSize: 13,
    margin: "0 0 16px",
  },
  tabs: {
    display: "flex",
    gap: 7,
    overflowX: "auto",
    paddingBottom: 10,
    marginBottom: 14,
  },
  tab: {
    flex: "0 0 auto",
    border: "1px solid #d9c49f",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#fffdf8",
    color: "#67451f",
    fontWeight: 700,
    cursor: "pointer",
  },
  activeTab: {
    background: "#896333",
    color: "#ffffff",
    borderColor: "#896333",
  },
  card: {
    background: "#fffdf8",
    border: "1px solid #eadcc3",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    margin: "12px 0 6px",
  },
  input: {
    width: "100%",
    minHeight: 43,
    border: "1px solid #d9c49f",
    borderRadius: 9,
    padding: "9px 11px",
    background: "#ffffff",
    color: "#402b20",
    fontSize: 14,
  },
  button: {
    width: "100%",
    border: 0,
    borderRadius: 10,
    padding: 13,
    marginTop: 14,
    background: "#896333",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d9c49f",
    borderRadius: 9,
    padding: "9px 12px",
    background: "#fffaf0",
    color: "#67451f",
    fontWeight: 700,
    cursor: "pointer",
  },
  item: {
    borderBottom: "1px solid #eee2ce",
    padding: "11px 0",
    fontSize: 13,
  },
  muted: {
    color: "#806c58",
    fontSize: 12,
  },
  message: {
    padding: 11,
    borderRadius: 9,
    background: "#f2e8d5",
    color: "#70542f",
    fontSize: 13,
    marginBottom: 12,
  },
};

function OperationsManagement({
  role,
  initialTab = "suppliers",
}: Props) {
  const currentUser = auth.currentUser;
  const userId = currentUser?.uid ?? "";
  const userName =
    currentUser?.displayName ||
    currentUser?.email ||
    "Business User";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [items, setItems] = useState<ItemData[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Supplier form
  const [supplierName, setSupplierName] = useState("");
  const [supplierMobile, setSupplierMobile] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");

  // Supplier payment form
  const [paymentSupplierId, setPaymentSupplierId] = useState("");
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState("");
  const [supplierPaymentMode, setSupplierPaymentMode] =
    useState<PaymentMode>("cash");
  const [supplierPaymentNote, setSupplierPaymentNote] = useState("");

  // Purchase form
  const [purchaseSupplierId, setPurchaseSupplierId] = useState("");
  const [purchaseItemId, setPurchaseItemId] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState("1");
  const [purchaseRate, setPurchaseRate] = useState("");
  const [purchasePaid, setPurchasePaid] = useState("0");
  const [purchaseMode, setPurchaseMode] =
    useState<PaymentMode>("cash");
  const [purchaseInvoice, setPurchaseInvoice] = useState("");

  // Expense form
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("अन्य");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseMode, setExpenseMode] =
    useState<PaymentMode>("cash");
  const [expenseNote, setExpenseNote] = useState("");

  // Wastage form
  const [wastageItemId, setWastageItemId] = useState("");
  const [wastageQuantity, setWastageQuantity] = useState("");
  const [wastageLoss, setWastageLoss] = useState("");
  const [wastageReason, setWastageReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    try {
      const [itemList, supplierList] = await Promise.all([
        getAllItems(),
        getSuppliers(),
      ]);

      setItems(itemList);
      setSuppliers(supplierList);
    } catch (error) {
      console.error(error);
      setMessage(
        "डेटा लोड नहीं हुआ। Internet और Firestore Security Rules जाँचें।"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const refresh = async () => {
    const [itemList, supplierList] = await Promise.all([
      getAllItems(),
      getSuppliers(),
    ]);
    setItems(itemList);
    setSuppliers(supplierList);
  };

  const handleAddSupplier = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!userId) {
      setMessage("Login User उपलब्ध नहीं है।");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await addSupplier({
        name: supplierName,
        mobile: supplierMobile,
        address: supplierAddress,
        userId,
      });

      setSupplierName("");
      setSupplierMobile("");
      setSupplierAddress("");
      await refresh();
      setMessage("Supplier सफलतापूर्वक जोड़ा गया।");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Supplier नहीं जुड़ा।"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSupplierPayment = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!paymentSupplierId) {
      setMessage("Supplier चुनें।");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await recordSupplierPayment({
        supplierId: paymentSupplierId,
        amount: Number(supplierPaymentAmount),
        paymentMode: supplierPaymentMode,
        userId,
        userName,
        role,
        note: supplierPaymentNote,
      });

      setSupplierPaymentAmount("");
      setSupplierPaymentNote("");
      await refresh();
      setMessage("Supplier Payment सफलतापूर्वक दर्ज हुआ।");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Payment दर्ज नहीं हुआ।"
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePurchase = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!purchaseSupplierId || !purchaseItemId) {
      setMessage("Supplier और Item दोनों चुनें।");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const purchaseId = await createPurchase({
        supplierId: purchaseSupplierId,
        items: [
          {
            itemId: purchaseItemId,
            quantity: Number(purchaseQuantity),
            rate: Number(purchaseRate),
          },
        ],
        paidAmount: Number(purchasePaid),
        paymentMode: purchaseMode,
        invoiceNumber: purchaseInvoice,
        userId,
        userName,
        role,
      });

      setPurchaseQuantity("1");
      setPurchaseRate("");
      setPurchasePaid("0");
      setPurchaseInvoice("");
      await refresh();
      setMessage(`Purchase दर्ज हुआ। Reference: ${purchaseId}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Purchase दर्ज नहीं हुआ।"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExpense = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      await createExpense({
        title: expenseTitle,
        category: expenseCategory,
        amount: Number(expenseAmount),
        paymentMode: expenseMode,
        note: expenseNote,
        userId,
        userName,
        role,
      });

      setExpenseTitle("");
      setExpenseAmount("");
      setExpenseNote("");
      setMessage("Expense सफलतापूर्वक दर्ज हुआ।");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Expense दर्ज नहीं हुआ।"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleWastage = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      await createWastage({
        itemId: wastageItemId,
        quantity: Number(wastageQuantity),
        estimatedLoss: Number(wastageLoss || 0),
        reason: wastageReason,
        userId,
        userName,
        role,
      });

      setWastageQuantity("");
      setWastageLoss("");
      setWastageReason("");
      await refresh();
      setMessage("Wastage दर्ज हुआ और Stock अपडेट हो गया।");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Wastage दर्ज नहीं हुआ।"
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedPurchaseItem = items.find(
    (item) => item.id === purchaseItemId
  );

  const selectedWastageItem = items.find(
    (item) => item.id === wastageItemId
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "suppliers", label: "🚚 Supplier" },
    { id: "purchase", label: "📥 Purchase" },
    { id: "inventory", label: "📦 Inventory" },
    { id: "expenses", label: "💸 Expense" },
    { id: "wastage", label: "🗑️ Wastage" },
  ];

  if (loading) {
    return <div style={styles.card}>डेटा लोड हो रहा है...</div>;
  }

  return (
    <section style={styles.page}>
      <h2 style={styles.heading}>Business Operations</h2>
      <p style={styles.subtitle}>
        Supplier, Purchase, Stock, Expense और Wastage Management
      </p>

      {message && (
        <div style={styles.message} role="status">
          {message}
        </div>
      )}

      <nav style={styles.tabs}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            style={{
              ...styles.tab,
              ...(tab === item.id ? styles.activeTab : {}),
            }}
            onClick={() => {
              setTab(item.id);
              setMessage("");
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "suppliers" && (
        <>
          <form style={styles.card} onSubmit={handleAddSupplier}>
            <h3>नया Supplier जोड़ें</h3>

            <label style={styles.label}>Supplier का नाम</label>
            <input
              style={styles.input}
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              required
            />

            <label style={styles.label}>मोबाइल नंबर</label>
            <input
              style={styles.input}
              value={supplierMobile}
              onChange={(e) => setSupplierMobile(e.target.value)}
              inputMode="numeric"
              required
            />

            <label style={styles.label}>पता (वैकल्पिक)</label>
            <input
              style={styles.input}
              value={supplierAddress}
              onChange={(e) => setSupplierAddress(e.target.value)}
            />

            <button style={styles.button} disabled={saving}>
              {saving ? "सेव हो रहा है..." : "Supplier सेव करें"}
            </button>
          </form>

          <form style={styles.card} onSubmit={handleSupplierPayment}>
            <h3>Supplier को Payment</h3>

            <label style={styles.label}>Supplier चुनें</label>
            <select
              style={styles.input}
              value={paymentSupplierId}
              onChange={(e) => setPaymentSupplierId(e.target.value)}
              required
            >
              <option value="">Supplier चुनें</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} — बकाया {money(supplier.outstandingBalance ?? 0)}
                </option>
              ))}
            </select>

            <label style={styles.label}>Payment राशि</label>
            <input
              style={styles.input}
              type="number"
              min="0.01"
              step="0.01"
              value={supplierPaymentAmount}
              onChange={(e) => setSupplierPaymentAmount(e.target.value)}
              required
            />

            <label style={styles.label}>Payment Mode</label>
            <select
              style={styles.input}
              value={supplierPaymentMode}
              onChange={(e) =>
                setSupplierPaymentMode(e.target.value as PaymentMode)
              }
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
            </select>

            <label style={styles.label}>नोट</label>
            <input
              style={styles.input}
              value={supplierPaymentNote}
              onChange={(e) => setSupplierPaymentNote(e.target.value)}
            />

            <button style={styles.button} disabled={saving}>
              {saving ? "सेव हो रहा है..." : "Payment दर्ज करें"}
            </button>
          </form>

          <div style={styles.card}>
            <h3>Supplier List</h3>
            {suppliers.length === 0 ? (
              <p style={styles.muted}>अभी कोई Supplier नहीं है।</p>
            ) : (
              suppliers.map((supplier) => (
                <div key={supplier.id} style={styles.item}>
                  <strong>{supplier.name}</strong>
                  <div>{supplier.mobile}</div>
                  <div style={styles.muted}>
                    कुल खरीद: {money(supplier.totalPurchases ?? 0)}
                    {" | "}भुगतान: {money(supplier.totalPaid ?? 0)}
                  </div>
                  <strong>
                    बकाया: {money(supplier.outstandingBalance ?? 0)}
                  </strong>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === "purchase" && (
        <form style={styles.card} onSubmit={handlePurchase}>
          <h3>नई Purchase Entry</h3>

          <label style={styles.label}>Supplier</label>
          <select
            style={styles.input}
            value={purchaseSupplierId}
            onChange={(e) => setPurchaseSupplierId(e.target.value)}
            required
          >
            <option value="">Supplier चुनें</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>

          <label style={styles.label}>Item</label>
          <select
            style={styles.input}
            value={purchaseItemId}
            onChange={(e) => {
              setPurchaseItemId(e.target.value);
              const item = items.find((x) => x.id === e.target.value);
              setPurchaseRate(item ? String(item.rate) : "");
            }}
            required
          >
            <option value="">Item चुनें</option>
            {items.filter((item) => item.active).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — Stock: {item.stock ?? 0} {item.unit}
              </option>
            ))}
          </select>

          <label style={styles.label}>Quantity</label>
          <input
            style={styles.input}
            type="number"
            min="0.001"
            step="0.001"
            value={purchaseQuantity}
            onChange={(e) => setPurchaseQuantity(e.target.value)}
            required
          />

          <label style={styles.label}>Purchase Rate</label>
          <input
            style={styles.input}
            type="number"
            min="0"
            step="0.01"
            value={purchaseRate}
            onChange={(e) => setPurchaseRate(e.target.value)}
            required
          />

          <div style={{ ...styles.message, marginTop: 12 }}>
            अनुमानित कुल:{" "}
            {money(Number(purchaseQuantity || 0) * Number(purchaseRate || 0))}
            {selectedPurchaseItem
              ? ` / ${selectedPurchaseItem.unit}`
              : ""}
          </div>

          <label style={styles.label}>अभी कितना भुगतान किया?</label>
          <input
            style={styles.input}
            type="number"
            min="0"
            step="0.01"
            value={purchasePaid}
            onChange={(e) => setPurchasePaid(e.target.value)}
            required
          />

          <label style={styles.label}>Payment Mode</label>
          <select
            style={styles.input}
            value={purchaseMode}
            onChange={(e) =>
              setPurchaseMode(e.target.value as PaymentMode)
            }
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>

          <label style={styles.label}>Supplier Invoice Number</label>
          <input
            style={styles.input}
            value={purchaseInvoice}
            onChange={(e) => setPurchaseInvoice(e.target.value)}
          />

          <button style={styles.button} disabled={saving}>
            {saving ? "Purchase सेव हो रही है..." : "Purchase सेव करें"}
          </button>
        </form>
      )}

      {tab === "inventory" && (
        <div style={styles.card}>
          <h3>वर्तमान Stock</h3>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => void refresh()}
          >
            ↻ Stock Refresh करें
          </button>

          {items.map((item) => {
            const stock = item.stock ?? 0;
            const lowLimit = item.lowStockLimit ?? 5;
            const low = stock <= lowLimit;

            return (
              <div key={item.id} style={styles.item}>
                <strong>{item.name}</strong>
                <div style={styles.muted}>
                  Category: {item.category} | Rate: {money(item.rate)}
                </div>
                <div>
                  Stock: <strong>{stock} {item.unit}</strong>
                  {" | "}
                  Low Limit: {lowLimit}
                </div>
                {low && (
                  <strong style={{ color: "#a33b22" }}>
                    ⚠️ Low Stock Alert
                  </strong>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "expenses" && (
        <form style={styles.card} onSubmit={handleExpense}>
          <h3>नया Expense दर्ज करें</h3>

          <label style={styles.label}>खर्च का नाम</label>
          <input
            style={styles.input}
            value={expenseTitle}
            onChange={(e) => setExpenseTitle(e.target.value)}
            required
          />

          <label style={styles.label}>Category</label>
          <select
            style={styles.input}
            value={expenseCategory}
            onChange={(e) => setExpenseCategory(e.target.value)}
          >
            <option>किराया</option>
             <option>बिजली</option>
            <option>यातायात</option>
            <option>मरम्मत</option>
            <option>सफाई</option>
            <option>अन्य</option>
          </select>

          <label style={styles.label}>राशि</label>
          <input
            style={styles.input}
            type="number"
            min="0.01"
            step="0.01"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            required
          />

          <label style={styles.label}>Payment Mode</label>
          <select
            style={styles.input}
            value={expenseMode}
            onChange={(e) =>
              setExpenseMode(e.target.value as PaymentMode)
            }
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>
          <label style={styles.label}>नोट</label>
          <input
            style={styles.input}
            value={expenseNote}
            onChange={(e) => setExpenseNote(e.target.value)}
          />

          <button style={styles.button} disabled={saving}>
            {saving ? "सेव हो रहा है..." : "Expense सेव करें"}
          </button>
        </form>
      )}

      {tab === "wastage" && (
        <form style={styles.card} onSubmit={handleWastage}>
          <h3>Wastage Entry</h3>

          <label style={styles.label}>Item चुनें</label>
          <select
            style={styles.input}
            value={wastageItemId}
            onChange={(e) => setWastageItemId(e.target.value)}
            required
          >
            <option value="">Item चुनें</option>
            {items.filter((item) => item.active).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — Stock: {item.stock ?? 0} {item.unit}
              </option>
            ))}
          </select>

          {selectedWastageItem && (
            <p style={styles.muted}>
              उपलब्ध Stock: {selectedWastageItem.stock ?? 0}{" "}
              {selectedWastageItem.unit}
            </p>
          )}

          <label style={styles.label}>Wastage Quantity</label>
          <input
            style={styles.input}
            type="number"
            min="0.001"
            step="0.001"
            value={wastageQuantity}
            onChange={(e) => setWastageQuantity(e.target.value)}
            required
          />

          <label style={styles.label}>अनुमानित नुकसान (₹)</label>
          <input
            style={styles.input}
            type="number"
            min="0"
            step="0.01"
            value={wastageLoss}
            onChange={(e) => setWastageLoss(e.target.value)}
          />
          <label style={styles.label}>Wastage का कारण</label>
          <textarea
            style={{ ...styles.input, minHeight: 75 }}
            value={wastageReason}
            onChange={(e) => setWastageReason(e.target.value)}
            required
          />

          <button style={styles.button} disabled={saving}>
            {saving ? "सेव हो रहा है..." : "Wastage सेव करें"}
          </button>
        </form>
      )}

      <p style={styles.muted}>
        वर्तमान में इस स्क्रीन में नए रिकॉर्ड जोड़ने और Stock देखने की सुविधा है।
        पुराने रिकॉर्ड Edit/Delete और PDF रिपोर्ट बाद के चरण में जोड़े जाएँगे।
      </p>
    </section>
  );
}

export default OperationsManagement;
