
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "./schema";

interface InvoiceItem {
  itemId?: string;
  itemName?: string;
  name?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  total?: number;
}

interface InvoiceRecord {
  id: string;
  invoiceNumber?: string;
  customerName?: string;
  customerMobile?: string;
  items?: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  total?: number;
  cashAmount?: number;
  upiAmount?: number;
  advanceUsed?: number;
  advanceAmount?: number;
  paidAmount?: number;
  balance?: number;
  createdAt?: number;
  status?: string;
  businessProfile?: {
    businessName?: string;
    tagline?: string;
    address?: string;
    phone?: string;
    logoDataUrl?: string;
  };
}

const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const dateText = (value?: number) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

export default function InvoiceHistory() {
  const [records, setRecords] = useState<InvoiceRecord[]>([]);
  const [selected, setSelected] = useState<InvoiceRecord | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const q = query(
          collection(db, COLLECTIONS.sales),
          orderBy("createdAt", "desc")
        );

        const result = await getDocs(q);

        if (!active) return;

        setRecords(
          result.docs
            .map((item) => ({
              id: item.id,
              ...item.data(),
            } as InvoiceRecord))
            .filter((item) => item.status !== "cancelled")
        );
      } catch (err) {
        console.error("Invoice History Error:", err);

        if (active) {
          setError(
            "पुराने बिल लोड नहीं हो पाए। Firestore Security Rules और इंटरनेट जाँचें।"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return records;

    return records.filter((item) =>
      [item.invoiceNumber, item.customerName, item.customerMobile].some(
        (value) => String(value || "").toLowerCase().includes(term)
      )
    );
  }, [records, search]);

  const profile = selected?.businessProfile;
  const items = selected?.items || [];
  const total = Number(selected?.total || 0);

  const paid = Number(
    selected?.paidAmount ??
      Number(selected?.cashAmount || 0) +
        Number(selected?.upiAmount || 0) +
        Number(selected?.advanceUsed ?? selected?.advanceAmount ?? 0)
  );

  const balance = Number(
    selected?.balance ?? Math.max(0, total - paid)
  );

  return (
    <main className="invoice-history">
      <style>{`
        .invoice-history {
          width: 100%;
          color: #402b20;
        }

        .ih-title {
          font-size: 22px;
          margin: 0 0 6px;
        }

        .ih-sub {
          font-size: 13px;
          color: #806c58;
          margin: 0 0 16px;
        }

        .ih-search {
          width: 100%;
          box-sizing: border-box;
          padding: 13px;
          border: 1px solid #d9c49f;
          border-radius: 12px;
          background: #fffdf8;
          font: inherit;
        }

        .ih-count {
          font-size: 12px;
          color: #806c58;
          margin: 10px 0;
        }

        .ih-list {
          display: grid;
          gap: 10px;
        }

        .ih-row {
          width: 100%;
          padding: 14px;
          border: 1px solid #eadcc3;
          border-radius: 14px;
          background: #fffdf8;
          color: #402b20;
          text-align: left;
          font: inherit;
          cursor: pointer;
        }

        .ih-row.active {
          border-color: #9b753d;
          background: #fff8e9;
        }

        .ih-rowtop {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 14px;
          font-weight: 800;
        }

        .ih-customer {
          font-size: 13px;
          font-weight: 700;
          margin-top: 7px;
        }

        .ih-meta {
          font-size: 11px;
          color: #806c58;
          margin-top: 5px;
        }

        .ih-empty,
        .ih-error {
          padding: 16px;
          border: 1px solid #eadcc3;
          border-radius: 13px;
          background: #fffdf8;
          font-size: 13px;
          line-height: 1.6;
        }

        .ih-error {
          color: #9b2c2c;
        }

        .ih-actions {
          display: flex;
          gap: 10px;
          margin: 16px 0 10px;
        }

        .ih-btn {
          border: 0;
          border-radius: 10px;
          background: #896333;
          color: white;
          padding: 11px 15px;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
        }

        .ih-btn.alt {
          background: #efe3ca;
          color: #67451f;
        }

        .ih-paper {
          box-sizing: border-box;
          width: 100%;
          max-width: 794px;
          margin: 0 auto;
          padding: 24px;
          background: white;
          color: #222;
          border: 1px solid #e1d8c9;
          font-family: Arial, "Noto Sans Devanagari", sans-serif;
        }

        .ih-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          border-bottom: 2px solid #8b6a3e;
          padding-bottom: 15px;
        }

        .ih-logo {
          max-width: 100px;
          max-height: 85px;
          object-fit: contain;
        }

        .ih-business {
          flex: 1;
          text-align: right;
        }

        .ih-business h2 {
          font-size: 22px;
          margin: 0 0 5px;
        }

        .ih-business p {
          font-size: 11px;
          color: #555;
          margin: 3px 0;
        }

        .ih-invtitle {
          text-align: center;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 1px;
          margin: 18px 0;
        }

        .ih-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 12px;
        }

        .ih-detail {
          border: 1px solid #ddd;
          padding: 10px;
          line-height: 1.7;
        }

        .ih-items,
        .ih-totals {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        .ih-items th,
        .ih-items td {
          border: 1px solid #ccc;
          padding: 8px 5px;
          text-align: left;
        }

        .ih-items th {
          background: #f4efe6;
        }

        .ih-num {
          text-align: right !important;
          white-space: nowrap;
        }

        .ih-totals {
          max-width: 320px;
          margin: 16px 0 0 auto;
          font-size: 12px;
        }

        .ih-totals td {
          padding: 6px;
          border-bottom: 1px solid #eee;
        }

        .ih-totals td:last-child {
          text-align: right;
          font-weight: 700;
        }

        .ih-grand {
          font-size: 15px;
          font-weight: 800;
          border-top: 2px solid #333;
        }

        .ih-note {
          font-size: 11px;
          color: #555;
          margin-top: 18px;
        }

        .ih-sign {
          display: flex;
          justify-content: space-between;
          margin-top: 45px;
          gap: 20px;
          font-size: 11px;
        }

        .ih-sign div {
          width: 45%;
          border-top: 1px solid #777;
          padding-top: 7px;
          text-align: center;
        }

        @media(max-width:520px) {
          .ih-paper {
            padding: 12px;
          }

          .ih-business h2 {
            font-size: 17px;
          }

          .ih-items {
            font-size: 9px;
          }

          .ih-items th,
          .ih-items td {
            padding: 5px 3px;
          }
        }

        /* PRINT FIX: केवल Invoice प्रिंट होगा */
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          html,
          body {
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden !important;
          }

          .invoice-history .ih-paper,
          .invoice-history .ih-paper * {
            visibility: visible !important;
          }

          .invoice-history {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          .ih-title,
          .ih-sub,
          .ih-search,
          .ih-count,
          .ih-list,
          .ih-actions {
            display: none !important;
          }

          .invoice-history .ih-paper {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            display: block !important;
            box-sizing: border-box !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            background: white !important;
            color: #000 !important;
            font-size: 10px !important;
            overflow: visible !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .ih-head {
            padding-bottom: 8px !important;
            gap: 10px !important;
          }

          .ih-logo {
            max-width: 75px !important;
            max-height: 60px !important;
          }

          .ih-business h2 {
            font-size: 18px !important;
            margin-bottom: 3px !important;
          }

          .ih-business p {
            font-size: 9px !important;
            margin: 2px 0 !important;
          }

          .ih-invtitle {
            font-size: 14px !important;
            margin: 10px 0 !important;
          }

          .ih-details {
            gap: 6px !important;
            margin-bottom: 9px !important;
            font-size: 9px !important;
          }

          .ih-detail {
            padding: 6px !important;
            line-height: 1.5 !important;
          }

          .ih-items {
            font-size: 9px !important;
          }

          .ih-items th,
          .ih-items td {
            padding: 4px 3px !important;
          }

          .ih-totals {
            max-width: 260px !important;
            margin-top: 8px !important;
            font-size: 10px !important;
          }

          .ih-totals td {
            padding: 3px 5px !important;
          }

          .ih-grand {
            font-size: 12px !important;
          }

          .ih-note {
            font-size: 9px !important;
            margin-top: 10px !important;
          }

          .ih-sign {
            margin-top: 28px !important;
            gap: 15px !important;
            font-size: 9px !important;
          }

          .ih-sign div {
            padding-top: 5px !important;
          }

          .ih-items tr,
          .ih-details,
          .ih-totals tr,
          .ih-sign {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <h2 className="ih-title">Invoice History</h2>

      <p className="ih-sub">
        पुराने बिल खोजें, देखें और दोबारा Print / Save PDF करें।
      </p>

      <input
        className="ih-search"
        type="search"
        placeholder="Invoice Number, ग्राहक का नाम या मोबाइल खोजें"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="ih-count">कुल बिल: {filtered.length}</div>

      {loading && (
        <div className="ih-empty">पुराने बिल लोड हो रहे हैं...</div>
      )}

      {error && (
        <div className="ih-error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="ih-empty">
          {records.length === 0
            ? "अभी तक कोई Invoice जारी नहीं हुआ है।"
            : "आपकी खोज से कोई बिल नहीं मिला।"}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="ih-list">
          {filtered.map((invoice) => (
            <button
              type="button"
              key={invoice.id}
              className={`ih-row ${
                selected?.id === invoice.id ? "active" : ""
              }`}
              onClick={() => setSelected(invoice)}
            >
              <div className="ih-rowtop">
                <span>{invoice.invoiceNumber || "Invoice"}</span>
                <span>{money(invoice.total)}</span>
              </div>

              <div className="ih-customer">
                {invoice.customerName || "Walk-in Customer"}
              </div>

              <div className="ih-meta">
                {dateText(invoice.createdAt)}
                {invoice.customerMobile
                  ? ` • ${invoice.customerMobile}`
                  : ""}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="ih-actions">
            <button
              className="ih-btn"
              type="button"
              onClick={() => window.print()}
            >
              Print / Save PDF
            </button>

            <button
              className="ih-btn alt"
              type="button"
              onClick={() => setSelected(null)}
            >
              बंद करें
            </button>
          </div>

          <article className="ih-paper">
            <header className="ih-head">
              {profile?.logoDataUrl ? (
                <img
                  className="ih-logo"
                  src={profile.logoDataUrl}
                  alt="Business Logo"
                />
              ) : (
                <div />
              )}

              <div className="ih-business">
                <h2>{profile?.businessName || "वृंदावन रसोई"}</h2>
                <p>
                  {profile?.tagline ||
                    "जहाँ स्वाद और सुकून साथ मिलते हैं"}
                </p>
                <p>
                  {profile?.address ||
                    "बिलंदा, फतेहपुर, उत्तर प्रदेश"}
                </p>
                <p>Phone: {profile?.phone || "7007418571"}</p>
              </div>
            </header>

            <div className="ih-invtitle">SALES INVOICE</div>

            <div className="ih-details">
              <div className="ih-detail">
                <strong>Bill To</strong>
                <br />
                {selected.customerName || "Walk-in Customer"}
                <br />
                {selected.customerMobile || "—"}
              </div>

              <div className="ih-detail">
                <strong>Invoice No.:</strong>{" "}
                {selected.invoiceNumber || "—"}
                <br />
                <strong>Date:</strong> {dateText(selected.createdAt)}
                <br />
                <strong>Status:</strong> Issued
              </div>
            </div>

            <table className="ih-items">
              <thead>
                <tr>
                  <th>क्र.</th>
                  <th>Item Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={`${
                      item.itemId || item.name || "item"
                    }-${index}`}
                  >
                    <td>{index + 1}</td>
                    <td>{item.itemName || item.name || "Item"}</td>
                    <td className="ih-num">
                      {Number(item.quantity || 0)}
                    </td>
                    <td>{item.unit || "—"}</td>
                    <td className="ih-num">{money(item.rate)}</td>
                    <td className="ih-num">
                      {money(
                        item.total ??
                          Number(item.quantity || 0) *
                            Number(item.rate || 0)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="ih-totals">
              <tbody>
                <tr>
                  <td>Subtotal</td>
                  <td>{money(selected.subtotal)}</td>
                </tr>

                <tr>
                  <td>Discount</td>
                  <td>{money(selected.discount)}</td>
                </tr>

                <tr className="ih-grand">
                  <td>Grand Total</td>
                  <td>{money(total)}</td>
                </tr>

                <tr>
                  <td>Cash</td>
                  <td>{money(selected.cashAmount)}</td>
                </tr>

                <tr>
                  <td>UPI</td>
                  <td>{money(selected.upiAmount)}</td>
                </tr>

                <tr>
                  <td>Advance Used</td>
                  <td>
                    {money(
                      selected.advanceUsed ?? selected.advanceAmount
                    )}
                  </td>
                </tr>

                <tr>
                  <td>Paid Amount</td>
                  <td>{money(paid)}</td>
                </tr>

                <tr>
                  <td>Balance</td>
                  <td>{money(balance)}</td>
                </tr>
              </tbody>
            </table>

            <p className="ih-note">
              यह पहले जारी किया गया Invoice है। इस रिकॉर्ड में बदलाव नहीं किया जा सकता।
            </p>

            <footer className="ih-sign">
              <div>Customer Signature</div>
              <div>Authorized Signature</div>
            </footer>
          </article>
        </>
      )}
    </main>
  );
}
