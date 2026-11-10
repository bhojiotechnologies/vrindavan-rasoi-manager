import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { auth } from "./firebase";
import {
  addCustomerAdvance,
  calculateAdvanceBalance,
  createCustomer,
  getCustomerAdvanceTransactions,
  getCustomers,
  type AdvanceRecord,
  type CustomerRecord,
} from "./customerService";

interface Props { role: "owner" | "staff"; }
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export default function CustomerManagement({ role }: Props) {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [ledger, setLedger] = useState<AdvanceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi">("cash");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");


  async function loadLedger(customer: CustomerRecord) {
    setSelected(customer);
    setError("");
    try { setLedger(await getCustomerAdvanceTransactions(customer.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "लेजर लोड नहीं हुआ।"); }
  }

  useEffect(() => {
    let alive = true;
    getCustomers().then((data) => { if (alive) setCustomers(data); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : "ग्राहक लोड नहीं हुए।"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) => customer.name.toLowerCase().includes(term) || customer.mobile.includes(term));
  }, [customers, search]);
  const balance = calculateAdvanceBalance(ledger);

  async function handleCreateCustomer() {
    setError(""); setMessage(""); setSaving(true);
    try {
      const userId = auth.currentUser?.uid ?? "";
      const id = await createCustomer({ name, mobile, address, userId });
      const customer: CustomerRecord = { id, name: name.trim(), mobile: mobile.replace(/\D/g, ""), address: address.trim(), createdAt: Date.now(), createdBy: userId };
      setCustomers((previous) => [...previous, customer].sort((a, b) => a.name.localeCompare(b.name)));
      setName(""); setMobile(""); setAddress(""); setMessage("ग्राहक सफलतापूर्वक सेव हो गया।");
      await loadLedger(customer);
    } catch (err) { setError(err instanceof Error ? err.message : "ग्राहक सेव नहीं हुआ।"); }
    finally { setSaving(false); }
  }

  async function handleAdvance() {
    if (!selected) return;
    setError(""); setMessage(""); setSaving(true);
    try {
      await addCustomerAdvance({ customerId: selected.id, customerName: selected.name, amount: Number(amount), paymentMode, note, userId: auth.currentUser?.uid ?? "" });
      setAmount(""); setNote("");
      await loadLedger(selected);
      setMessage("एडवांस जमा की एंट्री सेव हो गई।");
    } catch (err) { setError(err instanceof Error ? err.message : "एडवांस सेव नहीं हुआ।"); }
    finally { setSaving(false); }
  }

  return <main style={s.page}>
    <header style={s.header}><div><h2 style={s.heading}>Customer Management</h2><p style={s.sub}>ग्राहक, एडवांस और लेजर</p></div><span style={s.role}>{role.toUpperCase()}</span></header>
    <section style={s.card}><h3 style={s.title}>नया ग्राहक जोड़ें</h3>
      <label style={s.label}>ग्राहक का नाम</label><input style={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="पूरा नाम" />
      <label style={s.label}>मोबाइल नंबर</label><input style={s.input} inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 अंकों का मोबाइल" />
      <label style={s.label}>पता (वैकल्पिक)</label><textarea style={s.input} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ग्राहक का पता" />
      <button style={s.button} disabled={saving} onClick={handleCreateCustomer}>{saving ? "सेव हो रहा है..." : "+ ग्राहक सेव करें"}</button>
    </section>
    <section style={s.card}><h3 style={s.title}>ग्राहक सूची ({customers.length})</h3><input style={s.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="नाम या मोबाइल से खोजें" />
      {loading ? <p>लोड हो रहा है...</p> : filtered.length === 0 ? <p style={s.muted}>कोई ग्राहक नहीं मिला।</p> : filtered.map((customer) => <button key={customer.id} style={{ ...s.customer, ...(selected?.id === customer.id ? s.selected : {}) }} onClick={() => void loadLedger(customer)}><span><strong>{customer.name}</strong><small>{customer.mobile}</small></span><span style={s.arrow}>लेजर देखें →</span></button>)}
    </section>
    {selected && <>
      <section style={s.card}><h3 style={s.title}>ग्राहक लेजर</h3><h2 style={s.customerName}>{selected.name}</h2><p style={s.muted}>{selected.mobile}{selected.address ? ` • ${selected.address}` : ""}</p><div style={s.balance}><span>उपलब्ध एडवांस बैलेंस</span><strong>{money(balance)}</strong></div>
        <h4 style={s.title}>एडवांस जमा करें</h4><label style={s.label}>राशि (₹)</label><input style={s.input} type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="जमा राशि" />
        <label style={s.label}>भुगतान माध्यम</label><select style={s.input} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "cash" | "upi")}><option value="cash">Cash</option><option value="upi">UPI</option></select>
        <label style={s.label}>नोट (वैकल्पिक)</label><input style={s.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="जैसे अगली खरीद के लिए एडवांस" />
        <button style={s.button} disabled={saving || !amount || Number(amount) <= 0} onClick={() => void handleAdvance()}>{saving ? "सेव हो रहा है..." : "एडवांस जमा सेव करें"}</button>
      </section>
      <section style={s.card}><h3 style={s.title}>एडवांस ट्रांजैक्शन हिस्ट्री</h3>{ledger.length === 0 ? <p style={s.muted}>अभी कोई एडवांस एंट्री नहीं है।</p> : ledger.map((entry) => <div key={entry.id} style={s.entry}><div><strong>{entry.type === "deposit" ? "एडवांस जमा" : entry.type === "refund" ? "एडवांस वापसी" : "एडवांस समायोजन"}</strong><small>{new Date(entry.date).toLocaleString("en-IN")}</small>{entry.note && <small>{entry.note}</small>}</div><strong style={{ color: entry.type === "deposit" ? "#277347" : "#a33b2b" }}>{entry.type === "deposit" ? "+" : "−"}{money(entry.amount)}</strong></div>)}</section>
    </>}
    {error && <p role="alert" style={s.error}>{error}</p>}{message && <p style={s.success}>{message}</p>}
    <p style={s.notice}>ध्यान दें: इस चरण में ग्राहक प्रोफाइल और एडवांस जमा का रिकॉर्ड सेव होता है। बिल की Preview में एडवांस चुनना अभी वास्तविक कटौती या Sale Save नहीं करता। ग्राहक की खरीद/भुगतान हिस्ट्री वास्तविक बिल सेव होने के बाद जुड़ेगी।</p>
  </main>;
}

const s: Record<string, CSSProperties> = {
  page:{padding:16,background:"#f8f3e8",minHeight:"100vh",color:"#49321f"},header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18},heading:{margin:0,fontSize:23},sub:{margin:"5px 0",color:"#80694f"},role:{background:"#ead9b5",padding:"8px 12px",borderRadius:20,fontWeight:700,fontSize:12},card:{background:"#fffdf8",padding:16,borderRadius:14,marginBottom:15,border:"1px solid #e5d6b8"},title:{marginTop:0,color:"#67451f"},label:{display:"block",marginTop:12,marginBottom:6,fontWeight:600},input:{width:"100%",boxSizing:"border-box",padding:12,border:"1px solid #d8c6a5",borderRadius:8,fontSize:15,background:"white",color:"#49321f"},button:{width:"100%",border:0,borderRadius:9,padding:13,marginTop:14,background:"#805326",color:"white",fontWeight:700,fontSize:15},customer:{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,textAlign:"left",padding:12,marginTop:8,border:"1px solid #eadcc3",borderRadius:10,background:"#fffaf0",color:"#49321f"},selected:{border:"2px solid #9b753d",background:"#f7eedc"},arrow:{fontSize:12,color:"#805326",whiteSpace:"nowrap"},muted:{color:"#80694f",fontSize:13},customerName:{margin:"4px 0",fontSize:20},balance:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:14,margin:"14px 0",borderRadius:10,background:"#f1e7d2"},entry:{display:"flex",justifyContent:"space-between",gap:10,padding:"12px 0",borderBottom:"1px solid #eee2ce"},error:{color:"#a33b2b",background:"#fff0ed",padding:12,borderRadius:8},success:{color:"#216b42",background:"#eaf6ee",padding:12,borderRadius:8},notice:{fontSize:12,lineHeight:1.6,color:"#80694f",padding:12,background:"#f1e7d2",borderRadius:10}
};
