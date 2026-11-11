
import { useEffect, useState } from "react";

import type { SaleDraft, SaleDraftResult } from "./saleService";

import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

interface InvoicePreviewProps {
  sale: SaleDraft;
  result: SaleDraftResult;
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

function money(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function amountInWords(amount: number): string {
  const number = Math.round(amount);

  if (number === 0) return "Zero Rupees Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function underThousand(n: number): string {
    let text = "";

    if (n >= 100) {
      text += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }

    if (n >= 20) {
      text += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }

    if (n > 0) {
      text += ones[n] + " ";
    }

    return text.trim();
  }

  let n = number;
  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;

  const lakh = Math.floor(n / 100000);
  n %= 100000;

  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(underThousand(crore) + " Crore");
  if (lakh) parts.push(underThousand(lakh) + " Lakh");
  if (thousand) parts.push(underThousand(thousand) + " Thousand");
  if (n) parts.push(underThousand(n));

  return parts.join(" ") + " Rupees Only";
}

export default function InvoicePreview({
  sale,
  result,
  onClose,
}: InvoicePreviewProps) {
  const [business, setBusiness] =
    useState<BusinessProfile>(DEFAULT_PROFILE);

  const [profileLoading, setProfileLoading] = useState(true);

  const invoiceDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const paidAmount = Number(result.paidAmount || 0);
  const balance = Math.max(0, result.finalTotal - paidAmount);

  useEffect(() => {
    let mounted = true;

    async function loadBusinessProfile() {
      try {
        const snapshot = await getDoc(
          doc(db, "settings", "businessProfile")
        );

        if (!mounted) return;

        if (snapshot.exists()) {
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
        console.error("Invoice Business Profile error:", error);
      } finally {
        if (mounted) setProfileLoading(false);
      }
    }

    void loadBusinessProfile();

    return () => {
      mounted = false;
    };
  }, []);

  function printInvoice() {
    window.print();
  }

  return (
    <main className="invoice-page">
      <style>{`
        .invoice-page {
          min-height: 100vh;
          padding: 18px;
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
          background: #fff;
          border: 1px solid #d6d0c5;
          box-shadow: 0 4px 18px #00000012;
        }

        .invoice-top {
          display: flex;
          align-items: center;
          gap: 20px;
          padding-bottom: 17px;
          border-bottom: 2px solid #222;
        }

        .invoice-logo {
          width: 105px;
          height: 105px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .invoice-logo-placeholder {
          width: 105px;
          height: 105px;
          border: 1px dashed #999;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 27px;
          font-weight: bold;
          flex-shrink: 0;
        }

        .invoice-business {
          flex: 1;
          text-align: right;
        }

        .invoice-business h1 {
          font-size: 27px;
          margin: 0 0 5px;
        }

        .invoice-business p {
          font-size: 12px;
          margin: 4px 0;
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
          text-transform: uppercase;
        }

        .invoice-info-box p {
          font-size: 12px;
          margin: 5px 0;
        }

        .invoice-meta-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 17px;
          font-size: 12px;
        }

        .invoice-meta-table td {
          border: 1px solid #333;
          padding: 9px;
        }

        .invoice-items {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        .invoice-items th,
        .invoice-items td {
          border: 1px solid #333;
          padding: 9px 6px;
        }

        .invoice-items th {
          background: #eee;
          font-weight: bold;
          text-align: center;
        }

        .invoice-items td {
          vertical-align: middle;
        }

        .invoice-items .right {
          text-align: right;
        }

        .invoice-items .center {
          text-align: center;
        }

        .invoice-summary {
          display: flex;
          justify-content: space-between;
          gap: 18px;
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
          border-collapse: collapse;
          font-size: 12px;
        }

        .invoice-totals td {
          border: 1px solid #333;
          padding: 8px;
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
          align-items: flex-end;
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
          padding: 13px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          background: #79552e;
          color: white;
        }

        .invoice-actions .secondary {
          background: #e4d8c5;
          color: #49321f;
        }

        .invoice-loading {
          max-width: 794px;
          margin: 10px auto;
          text-align: center;
          font-size: 12px;
          color: #755b3b;
        }

        @media (max-width: 600px) {
          .invoice-paper {
            padding: 14px;
          }

          .invoice-top {
            gap: 10px;
          }

          .invoice-logo,
          .invoice-logo-placeholder {
            width: 72px;
            height: 72px;
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
            padding: 6px 3px;
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
            min-height: auto;
            background: white;
          }

          .invoice-paper {
            width: 100%;
            max-width: none;
            min-height: auto;
            padding: 5mm;
            border: 0;
            box-shadow: none;
          }

          .invoice-actions,
          .invoice-loading {
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

      {profileLoading && (
        <p className="invoice-loading">
          Business Profile लोड हो रहा है...
        </p>
      )}

      <section className="invoice-paper">
        <header className="invoice-top">
          {business.logoDataUrl ? (
            <img
              src={business.logoDataUrl}
              alt="वृंदावन रसोई Logo"
              className="invoice-logo"
            />
          ) : (
            <div className="invoice-logo-placeholder">
              VR
            </div>
          )}

          <div className="invoice-business">
            <h1>{business.businessName}</h1>
            <p>{business.tagline}</p>
            <p>{business.address}</p>
            <p>मोबाइल: {business.phone}</p>
            <p><strong>शुद्ध सात्विक भोजन</strong></p>
          </div>
        </header>

        <div className="invoice-title">
          SALES INVOICE
        </div>

        <div className="invoice-info-grid">
          <div className="invoice-info-box">
            <h3>Bill To / ग्राहक विवरण</h3>
            <p>
              <strong>ग्राहक का नाम:</strong>{" "}
              {sale.customerName || "Walk-in Customer"}
            </p>
            <p>
              <strong>मोबाइल:</strong> उपलब्ध नहीं
            </p>
          </div>

          <div className="invoice-info-box">
            <h3>Bill From / विक्रेता</h3>
            <p><strong>{business.businessName}</strong></p>
            <p>{business.address}</p>
            <p>मोबाइल: {business.phone}</p>
          </div>
        </div>

        <table className="invoice-meta-table">
          <tbody>
            <tr>
              <td><strong>Invoice No.:</strong> Draft Preview</td>
              <td><strong>Invoice Date:</strong> {invoiceDate}</td>
            </tr>
            <tr>
              <td><strong>Place of Supply:</strong> —</td>
              <td><strong>Payment Status:</strong> Preview</td>
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
                <td className="right">{item.rate.toFixed(2)}</td>
                <td className="right">
                  {(item.quantity * item.rate).toFixed(2)}
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
            <strong>Note:</strong> यह Invoice Preview है।
            वास्तविक Invoice जारी होने पर Invoice Number मिलेगा।
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
              Advance Adjusted:{" "}
              <strong>{money(result.advanceAmount)}</strong>
            </div>
            <div>
              Total Paid: <strong>{money(paidAmount)}</strong>
            </div>
            <div>
              Balance: <strong>{money(balance)}</strong>
            </div>
          </div>
        </section>

        <div className="invoice-signature">
          <div>
            Customer Signature
          </div>

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

      <div className="invoice-actions">
        <button type="button" onClick={printInvoice}>
          Print / Save PDF
        </button>

        <button
          type="button"
          className="secondary"
          onClick={onClose}
        >
          वापस जाएँ
        </button>
      </div>
    </main>
  );
}
