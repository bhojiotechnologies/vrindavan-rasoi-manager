import { printCurrentPage } from "./printUtils";
import { useEffect, useState } from "react";
import type { SaleDraft, SaleDraftResult } from "./saleService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

interface InvoicePreviewProps {
  sale: SaleDraft;
  result: SaleDraftResult;
  businessSnapshot?: Partial<BusinessProfile> | null;
  onSave: () => Promise<string>;
  onClose: () => void;
}

interface BusinessProfile {
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  logoDataUrl?: string;
}

const DEFAULT_PROFILE: BusinessProfile = {
  businessName: "वृंदावन रसोई",
  tagline: "जहाँ स्वाद और सुकून साथ मिलते हैं",
  address: "बिलंदा, फतेहपुर, उत्तर प्रदेश",
  phone: "7007418571",
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

function amountInWords(amount: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five",
    "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen",
    "Fifteen", "Sixteen", "Seventeen", "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "", "", "Twenty", "Thirty", "Forty",
    "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  function words(n: number): string {
    let text = "";

    if (n >= 100) {
      text += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }

    if (n >= 20) {
      text += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }

    if (n > 0) text += ones[n] + " ";

    return text.trim();
  }

  let n = Math.round(amount);

  if (n === 0) return "Zero Rupees Only";

  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;

  const lakh = Math.floor(n / 100000);
  n %= 100000;

  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(words(crore) + " Crore");
  if (lakh) parts.push(words(lakh) + " Lakh");
  if (thousand) parts.push(words(thousand) + " Thousand");
  if (n) parts.push(words(n));

  return parts.join(" ") + " Rupees Only";
}

export default function InvoicePreview({
  sale,
  result,
  businessSnapshot,
  onSave,
  onClose,
}: InvoicePreviewProps) {
  const [business, setBusiness] =
    useState<BusinessProfile>(DEFAULT_PROFILE);

  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [saveError, setSaveError] = useState("");

  const date = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const paid = Number(result.paidAmount || 0);
  const balance = Math.max(0, result.finalTotal - paid);

  useEffect(() => {
    let mounted = true;

    // Saved invoices pass their original business profile snapshot.
    // This prevents later Settings changes from altering old invoices.
    if (businessSnapshot) {
      setBusiness({
        businessName:
          businessSnapshot.businessName || DEFAULT_PROFILE.businessName,
        tagline:
          businessSnapshot.tagline || DEFAULT_PROFILE.tagline,
        address:
          businessSnapshot.address || DEFAULT_PROFILE.address,
        phone:
          businessSnapshot.phone || DEFAULT_PROFILE.phone,
        logoDataUrl:
          typeof businessSnapshot.logoDataUrl === "string"
            ? businessSnapshot.logoDataUrl
            : undefined,
      });
      setLoading(false);

      return () => {
        mounted = false;
      };
    }

    async function loadProfile() {
      try {
        const snapshot = await getDoc(
          doc(db, "settings", "businessProfile")
        );

        if (snapshot.exists() && mounted) {
          const data = snapshot.data();

          setBusiness({
            businessName: String(
              data.businessName || DEFAULT_PROFILE.businessName
            ),
            tagline: String(
              data.tagline || DEFAULT_PROFILE.tagline
            ),
            address: String(
              data.address || DEFAULT_PROFILE.address
            ),
            phone: String(
              data.phone || DEFAULT_PROFILE.phone
            ),
            logoDataUrl:
              typeof data.logoDataUrl === "string"
                ? data.logoDataUrl
                : undefined,
          });
        }
      } catch (error) {
        console.error("Business Profile Error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [businessSnapshot]);

  async function handleSave() {
    if (saving || invoiceNumber) return;

    setSaving(true);
    setSaveError("");

    try {
      const savedNumber = await onSave();

      if (typeof savedNumber !== "string" || !savedNumber.trim()) {
        throw new Error("Invoice Number प्राप्त नहीं हुआ।");
      }

      setInvoiceNumber(savedNumber);
    } catch (error) {
      console.error("Invoice Save Error:", error);

      setSaveError(
        error instanceof Error
          ? error.message
          : "Invoice जारी नहीं हो पाया।"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="invoice-page">
      <style>{`
        .invoice-page {
          min-height: 100vh;
          padding: 16px;
          background: #f3eee5;
          color: #222;
          font-family: Arial, "Noto Sans Devanagari", sans-serif;
        }

        .invoice-paper {
          width: 100%;
          max-width: 794px;
          min-height: 1123px;
          margin: auto;
          padding: 30px;
          background: white;
          border: 1px solid #d6d0c5;
          box-shadow: 0 4px 18px #00000012;
        }

        .invoice-top {
          display: flex;
          align-items: center;
          gap: 18px;
          padding-bottom: 16px;
          border-bottom: 2px solid #222;
        }

        .invoice-logo,
        .invoice-logo-placeholder {
          width: 100px;
          height: 100px;
          flex-shrink: 0;
        }

        .invoice-logo {
          object-fit: contain;
        }

        .invoice-logo-placeholder {
          border: 1px dashed #888;
          display: grid;
          place-items: center;
          font-size: 28px;
          font-weight: bold;
        }

        .invoice-business {
          flex: 1;
          text-align: right;
        }

        .invoice-business h1 {
          margin: 0 0 5px;
          font-size: 27px;
        }

        .invoice-business p {
          margin: 4px 0;
          font-size: 12px;
          line-height: 1.5;
        }

        .invoice-title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          letter-spacing: 2px;
          margin: 17px 0;
          text-decoration: underline;
        }

        .invoice-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid #333;
          margin-bottom: 16px;
        }

        .invoice-info-box {
          padding: 12px;
          min-height: 95px;
        }

        .invoice-info-box:first-child {
          border-right: 1px solid #333;
        }

        .invoice-info-box h3 {
          font-size: 13px;
          margin: 0 0 9px;
        }

        .invoice-info-box p {
          font-size: 12px;
          margin: 5px 0;
        }

        .invoice-meta,
        .invoice-items,
        .invoice-totals {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .invoice-meta {
          margin-bottom: 17px;
        }

        .invoice-meta td,
        .invoice-items th,
        .invoice-items td,
        .invoice-totals td {
          border: 1px solid #333;
          padding: 9px 6px;
        }

        .invoice-items {
          font-size: 11px;
        }

        .invoice-items th {
          background: #eee;
          text-align: center;
        }

        .right {
          text-align: right;
        }

        .center {
          text-align: center;
        }

        .invoice-summary {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-top: 17px;
          align-items: flex-start;
        }

        .invoice-words {
          flex: 1;
          border: 1px solid #333;
          padding: 12px;
          font-size: 12px;
          line-height: 1.7;
        }

        .invoice-totals {
          width: 255px;
        }

        .invoice-totals td:last-child {
          text-align: right;
          font-weight: bold;
        }

        .invoice-totals .grand td {
          background: #eee;
          font-size: 14px;
          font-weight: bold;
        }

        .invoice-payment {
          border: 1px solid #333;
          padding: 12px;
          margin-top: 17px;
          font-size: 12px;
        }

        .invoice-payment h3 {
          margin: 0 0 9px;
          font-size: 13px;
        }

        .invoice-payment-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .invoice-signature {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-top: 65px;
          font-size: 12px;
        }

        .invoice-signature div {
          width: 210px;
          text-align: center;
          border-top: 1px solid #333;
          padding-top: 8px;
        }

        .invoice-footer {
          text-align: center;
          border-top: 1px solid #333;
          margin-top: 35px;
          padding-top: 13px;
          font-size: 12px;
        }

        .invoice-actions {
          max-width: 794px;
          margin: 16px auto;
          display: flex;
          gap: 10px;
        }

        .invoice-actions button {
          flex: 1;
          border: 0;
          border-radius: 8px;
          padding: 13px 8px;
          font-size: 13px;
          font-weight: bold;
          cursor: pointer;
          background: #79552e;
          color: white;
        }

        .invoice-actions button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .invoice-actions .secondary {
          background: #e4d8c5;
          color: #49321f;
        }

        .invoice-success {
          max-width: 794px;
          margin: 12px auto;
          padding: 12px;
          background: #e2f5e8;
          color: #20723b;
          border-radius: 8px;
          font-weight: bold;
        }

        .invoice-error {
          max-width: 794px;
          margin: 12px auto;
          padding: 12px;
          background: #fde7e7;
          color: #a12626;
          border-radius: 8px;
        }

        @media (max-width: 600px) {
          .invoice-paper {
            padding: 12px;
          }

          .invoice-logo,
          .invoice-logo-placeholder {
            width: 70px;
            height: 70px;
          }

          .invoice-business h1 {
            font-size: 19px;
          }

          .invoice-business p {
            font-size: 10px;
          }

          .invoice-items {
            font-size: 9px;
          }

          .invoice-items th,
          .invoice-items td {
            padding: 5px 3px;
          }

          .invoice-summary {
            flex-direction: column;
          }

          .invoice-totals {
            width: 100%;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          body {
            margin: 0 !important;
            background: white !important;
          }

          .invoice-page {
            padding: 0;
            background: white;
          }

          .invoice-paper {
            max-width: none;
            min-height: auto;
            padding: 5mm;
            border: 0;
            box-shadow: none;
          }

          .invoice-actions,
          .invoice-success,
          .invoice-error {
            display: none !important;
          }

          .invoice-items tr,
          .invoice-info-grid,
          .invoice-summary,
          .invoice-payment,
          .invoice-signature {
            break-inside: avoid;
          }
        }
      `}</style>

      <section className="invoice-paper">
        <header className="invoice-top">
          {business.logoDataUrl ? (
            <img
              src={business.logoDataUrl}
              alt="Business Logo"
              className="invoice-logo"
            />
          ) : (
            <div className="invoice-logo-placeholder">VR</div>
          )}

          <div className="invoice-business">
            <h1>{business.businessName}</h1>
            <p>{business.tagline}</p>
            <p>{business.address}</p>
            <p>मोबाइल: {business.phone}</p>
            <p><strong>शुद्ध सात्विक भोजन</strong></p>
          </div>
        </header>

        <div className="invoice-title">SALES INVOICE</div>

        <div className="invoice-info-grid">
          <div className="invoice-info-box">
            <h3>Bill To / ग्राहक विवरण</h3>
            <p>
              <strong>ग्राहक:</strong>{" "}
              {sale.customerName || "Walk-in Customer"}
            </p>
            <p><strong>मोबाइल:</strong> उपलब्ध नहीं</p>
          </div>

          <div className="invoice-info-box">
            <h3>Bill From / विक्रेता</h3>
            <p><strong>{business.businessName}</strong></p>
            <p>{business.address}</p>
            <p>मोबाइल: {business.phone}</p>
          </div>
        </div>

        <table className="invoice-meta">
          <tbody>
            <tr>
              <td>
                <strong>Invoice No.:</strong>{" "}
                {invoiceNumber || "Draft Preview"}
              </td>
              <td><strong>Date:</strong> {date}</td>
            </tr>
            <tr>
              <td><strong>Place of Supply:</strong> —</td>
              <td>
                <strong>Status:</strong>{" "}
                {invoiceNumber ? "Issued" : "Preview"}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="invoice-items">
          <thead>
            <tr>
              <th>क्र.</th>
              <th>Item Description</th>
              <th>HSN/SAC</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Rate (₹)</th>
              <th>Amount (₹)</th>
            </tr>
          </thead>

          <tbody>
            {sale.items.map((item, index) => (
              <tr key={`${item.itemId}-${index}`}>
                <td className="center">{index + 1}</td>
                <td>{item.name}</td>
                <td className="center">—</td>
                <td className="right">{item.quantity}</td>
                <td className="center">{item.unit}</td>
                <td className="right">{money(item.rate)}</td>
                <td className="right">
                  {money(item.quantity * item.rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-summary">
          <div className="invoice-words">
            <strong>Amount in Words:</strong>
            <br />
            {amountInWords(result.finalTotal)}
            <br /><br />
            <strong>Note:</strong>{" "}
            {invoiceNumber
              ? "Invoice जारी कर दिया गया है।"
              : "यह Invoice Preview है।"}
          </div>

          <table className="invoice-totals">
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td>{money(result.subtotal)}</td>
              </tr>
              <tr>
                <td>Discount</td>
                <td>{money(result.discount)}</td>
              </tr>
              <tr className="grand">
                <td>Grand Total</td>
                <td>{money(result.finalTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <section className="invoice-payment">
          <h3>Payment Details / भुगतान विवरण</h3>

          <div className="invoice-payment-grid">
            <div>Cash: <strong>{money(result.cashAmount)}</strong></div>
            <div>UPI: <strong>{money(result.upiAmount)}</strong></div>
            <div>
              Advance: <strong>{money(result.advanceAmount)}</strong>
            </div>
            <div>Total Paid: <strong>{money(paid)}</strong></div>
            <div>Balance: <strong>{money(balance)}</strong></div>
          </div>
        </section>

        <div className="invoice-signature">
          <div>Customer Signature</div>
          <div>
            For {business.businessName}
            <br /><br />
            Authorized Signatory
          </div>
        </div>

        <footer className="invoice-footer">
          <strong>धन्यवाद! पुनः पधारें।</strong>
          <p>{business.businessName} — आपका अपना सात्विक भोजनालय</p>
          <p>{business.tagline}</p>
        </footer>
      </section>

      {saveError && (
        <div className="invoice-error" role="alert">
          {saveError}
        </div>
      )}

      {invoiceNumber && (
        <div className="invoice-success">
          Invoice सफलतापूर्वक जारी हुआ: {invoiceNumber}
        </div>
      )}

      <div className="invoice-actions">
        <button
          type="button"
          onClick={() => window.print()}
        >
          Print / Save PDF
        </button>

        <button
          type="button"
          disabled={saving || Boolean(invoiceNumber)}
          onClick={() => void handleSave()}
        >
          {saving
            ? "Invoice जारी हो रहा है..."
            : invoiceNumber
              ? "Invoice जारी हो चुका है"
              : "Invoice जारी करें"}
        </button>

        <button
          type="button"
          className="secondary"
          disabled={saving}
          onClick={onClose}
        >
          वापस जाएँ
        </button>
      </div>
    </main>
  );
              }
