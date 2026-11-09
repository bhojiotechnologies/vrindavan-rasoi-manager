import { useEffect, useState } from "react";
import {
  addItem,
  getAllItems,
  updateItem,
  setItemStatus,
  type ItemData,
} from "./itemService";

interface ItemMasterProps {
  role: "owner" | "staff";
}

const emptyForm = {
  name: "",
  category: "",
  unit: "Plate",
  rate: "",
};

export default function ItemMaster({ role }: ItemMasterProps) {
  const [items, setItems] = useState<ItemData[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isOwner = role === "owner";

  async function loadItems() {
    try {
      setLoading(true);
      setError("");
      const data = await getAllItems();
      setItems(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Items लोड नहीं हो सके।"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function startEdit(item: ItemData) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      rate: String(item.rate),
    });
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isOwner) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const itemData = {
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit.trim(),
        rate: Number(form.rate),
      };

      if (!Number.isFinite(itemData.rate) || itemData.rate < 0) {
        throw new Error("कृपया सही कीमत दर्ज करें।");
      }

      if (editingId) {
        await updateItem(editingId, itemData);
        setMessage("Item सफलतापूर्वक अपडेट हो गया।");
      } else {
        await addItem({ ...itemData, active: true });
        setMessage("नया Item सफलतापूर्वक जुड़ गया।");
      }

      resetForm();
      await loadItems();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "कार्य पूरा नहीं हो सका।"
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: ItemData) {
    if (!isOwner) return;

    try {
      setError("");
      setMessage("");

      await setItemStatus(item.id, !item.active);
      setMessage(
        item.active ? "Item Inactive कर दिया गया।" : "Item Active कर दिया गया।"
      );

      await loadItems();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Status बदल नहीं सका।"
      );
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.heading}>Item Master</h2>
          <p style={styles.subtitle}>वृंदावन रसोई</p>
        </div>
        <span style={styles.count}>{items.length} Items</span>
      </header>

      {isOwner && (
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>
            {editingId ? "Item Edit करें" : "नया Item जोड़ें"}
          </h3>

          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Item का नाम</label>
            <input
              style={styles.input}
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="जैसे - मसाला चाय"
              required
            />

            <label style={styles.label}>Category</label>
            <input
              style={styles.input}
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="जैसे - चाय, नाश्ता, भोजन"
              required
            />

            <label style={styles.label}>Unit</label>
            <select
              style={styles.input}
              name="unit"
              value={form.unit}
              onChange={handleChange}
            >
              <option value="Plate">Plate</option>
              <option value="Piece">Piece</option>
              <option value="Cup">Cup</option>
              <option value="Glass">Glass</option>
              <option value="Kg">Kg</option>
              <option value="Gram">Gram</option>
              <option value="Litre">Litre</option>
              <option value="Packet">Packet</option>
              <option value="Other">Other</option>
            </select>

            <label style={styles.label}>विक्रय मूल्य (₹)</label>
            <input
              style={styles.input}
              type="number"
              name="rate"
              value={form.rate}
              onChange={handleChange}
              placeholder="0"
              min="0"
              step="0.01"
              required
            />

            <div style={styles.actions}>
              <button
                style={styles.primaryButton}
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "कृपया प्रतीक्षा करें..."
                  : editingId
                  ? "Update Item"
                  : "Add Item"}
              </button>

              {editingId && (
                <button
                  style={styles.secondaryButton}
                  type="button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>सभी Items</h3>

        {loading ? (
          <p>Items लोड हो रहे हैं...</p>
        ) : items.length === 0 ? (
          <p style={styles.empty}>
            अभी कोई Item नहीं जोड़ा गया है।
            {isOwner && " ऊपर दिए गए फॉर्म से पहला Item जोड़ें।"}
          </p>
        ) : (
          <div style={styles.list}>
            {items.map((item) => (
              <article key={item.id} style={styles.item}>
                <div style={{ flex: 1 }}>
                  <strong>{item.name}</strong>
                  <p style={styles.itemInfo}>
                    {item.category} · {item.unit}
                  </p>
                  <strong>₹{item.rate.toFixed(2)}</strong>
                  <p style={styles.itemInfo}>
                    {item.active ? "Active" : "Inactive"}
                  </p>
                </div>

                {isOwner && (
                  <div style={styles.itemActions}>
                    <button
                      style={styles.smallButton}
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      style={styles.secondaryButton}
                      onClick={() => void toggleStatus(item)}
                    >
                      {item.active ? "Inactive" : "Active"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    marginBottom: 20,
  },
  heading: { margin: 0, fontSize: 24 },
  subtitle: { margin: "5px 0", color: "#80694f" },
  count: {
    background: "#ead9b5",
    padding: "8px 12px",
    borderRadius: 20,
    fontWeight: 600,
  },
  card: {
    background: "#fffdf8",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    border: "1px solid #e5d6b8",
  },
  cardTitle: { marginTop: 0, color: "#67451f" },
  label: {
    display: "block",
    marginTop: 12,
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
  actions: {
    display: "flex",
    gap: 10,
    marginTop: 16,
    flexWrap: "wrap",
  },
  primaryButton: {
    background: "#79552e",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "11px 18px",
    fontWeight: 600,
  },
  secondaryButton: {
    background: "#eadfc9",
    color: "#49321f",
    border: 0,
    borderRadius: 8,
    padding: "9px 12px",
  },
  smallButton: {
    background: "#79552e",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "9px 12px",
  },
  error: { color: "#b42318", fontWeight: 600 },
  success: { color: "#237447", fontWeight: 600 },
  empty: { color: "#80694f", lineHeight: 1.6 },
  list: { display: "grid", gap: 10 },
  item: {
    display: "flex",
    gap: 10,
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #eadfc9",
    padding: "12px 0",
  },
  itemInfo: { margin: "5px 0", color: "#80694f", fontSize: 13 },
  itemActions: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
};
                    
