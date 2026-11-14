import { useEffect, useMemo, useState } from "react";
import { getCustomers, type CustomerRecord } from "./customerService";
import { getCustomerLedger, recordCustomerPayment, type LedgerRow } from "./customerLedgerService";

const money = (n:number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(n);
const dateText = (n:number) => new Date(n).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});

export default function CustomerLedger() {
  const [customers,setCustomers] = useState<CustomerRecord[]>([]);
  const [customerId,setCustomerId] = useState("");
  const [rows,setRows] = useState<LedgerRow[]>([]);
  const [amount,setAmount] = useState(""); const [mode,setMode] = useState<"cash"|"upi">("cash");
  const [note,setNote] = useState(""); const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  const customer = customers.find(c=>c.id===customerId);
  const balance = rows.length ? rows[rows.length-1].balance : 0;
  async function refresh(id:string) { setRows(await getCustomerLedger(id)); }
  useEffect(()=>{ getCustomers().then(setCustomers).catch(e=>setError(e.message)); },[]);
  useEffect(()=>{ if(customerId) refresh(customerId).catch(e=>setError(e.message)); else setRows([]); },[customerId]);
  const totals = useMemo(()=>rows.reduce((a,r)=>({debit:a.debit+r.debit,credit:a.credit+r.credit}),{debit:0,credit:0}),[rows]);
  async function addPayment(){ if(!customer) return; setBusy(true); setError(""); try { await recordCustomerPayment({customerId,customerName:customer.name,amount:Number(amount),paymentMode:mode,note}); setAmount("");setNote("");await refresh(customerId); } catch(e){setError(e instanceof Error?e.message:"भुगतान सेव नहीं हुआ।");} finally{setBusy(false);} }
  return <main className="module-card">
    <h2>ग्राहक उधार खाता</h2>
    <p>खरीद, आंशिक भुगतान और आगे का बकाया—तारीखवार पूरा विवरण।</p>
    <label>ग्राहक चुनें</label>
    <select style={{width:"100%",padding:12,margin:"8px 0 16px"}} value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">ग्राहक चुनें</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name} — {c.mobile}</option>)}</select>
    {customer && <>
      <div className="module-card"><strong>{customer.name}</strong><div>{customer.mobile}</div><h3>वर्तमान बकाया: {money(balance)}</h3><small>कुल खरीद शेष: {money(totals.debit)} | जमा भुगतान: {money(totals.credit)}</small></div>
      <div className="module-card"><h3>भुगतान जमा करें</h3><input type="number" min="1" step="0.01" placeholder="भुगतान राशि ₹" value={amount} onChange={e=>setAmount(e.target.value)} /><select value={mode} onChange={e=>setMode(e.target.value as "cash"|"upi")}><option value="cash">Cash</option><option value="upi">UPI</option></select><input placeholder="नोट (वैकल्पिक)" value={note} onChange={e=>setNote(e.target.value)} /><button disabled={busy} onClick={addPayment}>{busy?"सेव हो रहा है...":"भुगतान सेव करें"}</button></div>
      <div id="customer-ledger-print"><h2>वृंदावन रसोई — ग्राहक खाता विवरण</h2><p>ग्राहक: {customer.name} | मोबाइल: {customer.mobile}</p><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th>दिनांक</th><th>विवरण</th><th>खरीद</th><th>जमा</th><th>शेष</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{dateText(r.date)}</td><td>{r.description}{r.items?.length? <small style={{display:"block"}}>{r.items.map(i=>`${i.itemName||i.name||"Item"} ${i.quantity||1} ${i.unit||""}`).join(", ")}</small>:null}</td><td>{r.debit?money(r.debit):"—"}</td><td>{r.credit?money(r.credit):"—"}</td><td>{money(r.balance)}</td></tr>)}</tbody></table><p><b>अंतिम बकाया: {money(balance)}</b></p></div>
      <button onClick={()=>window.print()}>PDF / प्रिंट निकालें</button>
    </>}
    {error && <p style={{color:"#b42318"}}>{error}</p>}
    <style>{`@media print { body * { visibility:hidden } #customer-ledger-print,#customer-ledger-print * {visibility:visible} #customer-ledger-print {position:absolute;left:0;top:0;width:100%;padding:12mm} #customer-ledger-print table th,#customer-ledger-print table td {border:1px solid #555;padding:6px;text-align:left;font-size:11px} }`}</style>
  </main>;
}
