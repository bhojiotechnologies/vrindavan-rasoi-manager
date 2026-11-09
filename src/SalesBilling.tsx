import { createPortal } from "react-dom";
import type { SaleDraft, SaleDraftResult } from "./saleService";

interface InvoicePreviewProps {
  sale: SaleDraft;
  result: SaleDraftResult;
  onClose: () => void;
}

function money(value: number): string {
  return `₹${value.toFixed(2)}`;
}

export default function InvoicePreview({
  sale,
  result,
  onClose,
}: InvoicePreviewProps) {
  const date = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function printInvoice() {
    window.print();
  }

  return createPortal(
    <div className="invoice-page">
      <style>{`
        .invoice-page {
          box-sizing: border-box;
          background: #f8f1e5;
          min-height: 100vh;
          padding: 16px;
          color: #49321f;
          font-family: Arial, sans-serif;
        }

        .invoice-paper {
          box-sizing: border-box;
          width: 100%;
          max-width: 700px;
          margin: auto;
          padding: 24px;
          background: #fffdf8;
          border: 1px solid #d8bd83;
          border-radius: 10px;
        }

        .invoice-header {
          text-align: center;
          border-bottom: 2px solid #b58a43;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }

        .invoice-header h1 {
          margin: 0 0 6px;
          color: #70451f;
        }

        .invoice-header p {
          margin: 4px 0;
          font-size: 13px;
        }

        .invoice-meta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .invoice-table th,
        .invoice-table td {
          border: 1px solid #d8c9ad;
          padding: 9px 6px;
          text-align: left;
        }

        .invoice-table th {
          background: #f1e4ca;
        }

        .invoice-table .number {
          text-align: right;
        }

        .invoice-totals {
          max-width: 300px;
          margin: 18px 0 0 auto;
        }

        .invoice-total-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 6px 0;
          border-bottom: 1px solid #eadfc9;
        }

        .invoice-grand-total {
          font-size: 19px;
          font-weight: bold;
          color: #70451f;
        }

        .invoice-footer {
          text-align: center;
          border-top: 1px solid #d8bd83;
          margin-top: 24px;
          padding-top: 14px;
          font-size: 13px;
        }

        .invoice-actions {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin: 16px auto;
          max-width: 700px;
        }

        .invoice-actions button {
          border: 0;
          border-radius: 7px;
          padding: 12px 18px;
          font-weight: bold;
          background: #805326;
          color: white;
          cursor: pointer;
        }

        .invoice-actions .secondary {
          background: #e8dcc8;
          color: #49321f;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          html,
          body {
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
          }

          body > *:not(.invoice-page) {
            display: none !important;
          }

          body > .invoice-page {
            display: block !important;
            position: static !important;
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #49321f !important;
            overflow: visible !important;
          }

          .invoice-paper {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 5mm !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }

          .invoice-actions {
            display: none !important;
          }

          .invoice-header,
          .invoice-totals,
          .invoice-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .invoice-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .invoice-table th {
            background: #f1e4ca !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="invoice-paper">
        <header className="invoice-header">
          <h1>वृंदावन रसोई</h1>
          <p>जहाँ स्वाद और सुकून साथ मिलते हैं</p>
          <p>बिलंदा, फतेहपुर, उत्तर प्रदेश</p>
          <p>मोबाइल: 7007418571</p>
          <p>
            <strong>शुद्ध सात्विक भोजन</strong>
          </p>
        </header>

        <div className="invoice-meta">
          <div>
            <strong>ग्राहक:</strong> {sale.customerName}
          </div>

          {sale.customerMobile && <div><strong>मोबाइल:</strong> {sale.customerMobile}</div>}
          <div>
            <strong>दिनांक:</strong> {date}
          </div>

          <div>
            <strong>बिल:</strong> Draft Preview
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>क्र.</th>
              <th>विवरण</th>
              <th className="number">मात्रा</th>
              <th className="number">दर</th>
              <th className="number">राशि</th>
            </tr>
          </thead>

          <tbody>
            {sale.items.map((item, index) => (
              <tr key={`${item.itemId}-${index}`}>
                <td>{index + 1}</td>
                <td>{item.name}</td>
                <td className="number">{item.quantity}</td>
                <td className="number">{money(item.rate)}</td>
                <td className="number">
                  {money(item.quantity * item.rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div className="invoice-total-row">
            <span>कुल राशि</span>
            <strong>{money(result.subtotal)}</strong>
          </div>

          <div className="invoice-total-row">
            <span>Discount</span>
            <strong>{money(result.discount)}</strong>
          </div>

          <div className="invoice-total-row invoice-grand-total">
            <span>देय राशि</span>
            <span>{money(result.finalTotal)}</span>
          </div>

          <div className="invoice-total-row">
            <span>Cash</span>
            <strong>{money(result.cashAmount)}</strong>
          </div>

          <div className="invoice-total-row">
            <span>UPI</span>
            <strong>{money(result.upiAmount)}</strong>
          </div>

          <div className="invoice-total-row">
            <span>Advance समायोजन</span>
            <strong>{money(result.advanceAmount)}</strong>
          </div>

          <div className="invoice-total-row">
            <span>कुल भुगतान</span>
            <strong>{money(result.paidAmount)}</strong>
          </div>
        </div>

        <footer className="invoice-footer">
          <strong>धन्यवाद! पुनः पधारें।</strong>
          <p>वृंदावन रसोई — आपका अपना सात्विक भोजनालय</p>
          <small>
            यह केवल बिल का Draft Preview है, जारी Invoice नहीं।
          </small>
        </footer>
      </div>

      <div className="invoice-actions">
        <button onClick={printInvoice}>
          Print / Save PDF
        </button>

        <button className="secondary" onClick={onClose}>
          वापस जाएँ
        </button>
      </div>
    </div>,
    document.body
  );
}
