import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { auth } from "./firebase";
import { printCurrentPage } from "./printUtils";
import {
  addCustomerAdvance, calculateAdvanceBalance, createCustomer,
  getCustomerAdvanceTransactions, getCustomers,
  type AdvanceRecord, type CustomerRecord,
} from "./customerService";
import {
  getCustomerLedger, recordCustomerLedgerEntry, recordCustomerPayment,
  type LedgerItem, type LedgerRow,
} from "./customerLedgerService";

interface Props { role: "owner" | "staff"; }
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const dateLabel = (value: number) => new Date(value).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });

export default function CustomerManagement({ role }: Props) {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [advanceLedger, setAdvanceLedger] = useState<AdvanceRecord[]>([]);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState(""); const [mobile, setMobile] = useState(""); const [address, setAddress] = useState("");
  const [entryType, setEntryType] = useState<"items" | "amount">("items");
  const [entryDate, setEntryDate] = useState(today());
  const [description, setDescription] = useState("");
  const [itemName, setItemName] = useState(""); const [itemQty, setItemQty] = useState("1"); const [itemRate, setItemRate] = useState("");
  const [entryItems, setEntryItems] = useState<LedgerItem[]>([]); const [manualAmount, setManualAmount] = useState("");
  const [payAmount, setPayAmount] = useState(""); const [payMode, setPayMode] = useState<"cash" | "upi">("cash"); const [payNote, setPayNote] = useState(""); const [payDate, setPayDate] = useState(today());
  const [advanceAmount, setAdvanceAmount] = useState(""); const [advanceMode, setAdvanceMode] = useState<"cash" | "upi">("cash"); const [advanceNote, setAdvanceNote] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");

  async function refresh(customer: CustomerRecord) {
    setSelected(customer); setError("");
    const [ledgerRows, advanceRows] = await Promise.all([getCustomerLedger(customer.id), getCustomerAdvanceTransactions(customer.id)]);
    setRows(ledgerRows); setAdvanceLedger(advanceRows);
  }
  useEffect(() => { let alive = true; getCustomers().then((data) => { if (alive) setCustomers(data); }).catch((err) => { if (alive) setError(err instanceof Error ? err.message : "ग्राहक लोड नहीं हुए।"); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, []);
  const filtered = useMemo(() => { const term = search.trim().toLowerCase(); return term ? customers.filter((c) => c.name.toLowerCase().includes(term) || c.mobile.includes(term)) : customers; }, [customers, search]);
  const advanceBalance = calculateAdvanceBalance(advanceLedger);
  const due = rows.length ? rows[rows.length - 1].balance : 0;
  const entryTotal = entryItems.reduce((sum, item) => sum + item.total, 0);

  async function handleCreateCustomer() {
    setError(""); setMessage(""); setSaving(true);
    try { const userId = auth.currentUser?.uid ?? ""; const id = await createCustomer({ name, mobile, address, userId }); const c: CustomerRecord = { id, name:name.trim(), mobile:mobile.replace(/\D/g,""), address:address.trim(), createdAt:Date.now(), createdBy:userId }; setCustomers((old) => [...old,c].sort((a,b)=>a.name.localeCompare(b.name))); setName("");setMobile("");setAddress(""); await refresh(c); setMessage("ग्राहक सेव हो गया।"); }
    catch (err) { setError(err instanceof Error ? err.message : "ग्राहक सेव नहीं हुआ।"); } finally { setSaving(false); }
  }
  function addEntryItem() {
    const qty=Number(itemQty), rate=Number(itemRate);
    if (!itemName.trim() || !Number.isFinite(qty) || qty<=0 || !Number.isFinite(rate) || rate<=0) { setError("सामान का नाम, मात्रा और सही रेट भरें।"); return; }
    setEntryItems((old)=>[...old,{name:itemName.trim(),quantity:qty,unit:"पीस",rate,total:Number((qty*rate).toFixed(2))}]); setItemName("");setItemQty("1");setItemRate("");setError("");
  }
  async function saveEntry() {
    if (!selected) return; setError("");setMessage("");setSaving(true);
    try { await recordCustomerLedgerEntry({ customerId:selected.id,customerName:selected.name,date:entryDate,description,items:entryType==="items"?entryItems:[],amount:entryType==="amount"?Number(manualAmount):undefined }); await refresh(selected);setEntryItems([]);setDescription("");setManualAmount("");setMessage("उधार खरीद की एंट्री सेव हो गई।"); }
    catch(err){setError(err instanceof Error?err.message:"एंट्री सेव नहीं हुई।");}finally{setSaving(false);}
  }
  async function savePayment() {
    if (!selected) return;setError("");setMessage("");setSaving(true);
    try { await recordCustomerPayment({customerId:selected.id,customerName:selected.name,amount:Number(payAmount),paymentMode:payMode,note:payNote,date:payDate});await refresh(selected);setPayAmount("");setPayNote("");setMessage("ग्राहक का भुगतान सेव हो गया।"); }
    catch(err){setError(err instanceof Error?err.message:"भुगतान सेव नहीं हुआ।");}finally{setSaving(false);}
  }
  async function saveAdvance() {
    if(!selected)return;setError("");setMessage("");setSaving(true);
    try{await addCustomerAdvance({customerId:selected.id,customerName:selected.name,amount:Number(advanceAmount),paymentMode:advanceMode,note:advanceNote,userId:auth.currentUser?.uid??""});setAdvanceAmount("");setAdvanceNote("");setAdvanceLedger(await getCustomerAdvanceTransactions(selected.id));setMessage("एडवांस जमा सेव हो गया।");}
    catch(err){setError(err instanceof Error?err.message:"एडवांस सेव नहीं हुआ।");}finally{setSaving(false);}
  }

  return <main style={s.page}>
    <header style={s.header}><div><h2 style={s.heading}>Customer Management</h2><p style={s.sub}>ग्राहक और उधार खाता</p></div><span style={s.role}>{role.toUpperCase()}</span></header>
    <section style={s.card}><h3 style={s.title}>नया ग्राहक जोड़ें</h3>
      <label style={s.label}>ग्राहक का नाम</label><input style={s.input} value={name} onChange={e=>setName(e.target.value)} placeholder="पूरा नाम"/>
      <label style={s.label}>मोबाइल नंबर</label><input style={s.input} inputMode="numeric" maxLength={10} value={mobile} onChange={e=>setMobile(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10 अंकों का मोबाइल"/>
      <label style={s.label}>पता (वैकल्पिक)</label><textarea style={s.input} rows={2} value={address} onChange={e=>setAddress(e.target.value)}/><button style={s.button} disabled={saving||!name.trim()||mobile.length!==10} onClick={()=>void handleCreateCustomer()}>+ ग्राहक सेव करें</button>
    </section>
    <section style={s.card}><h3 style={s.title}>ग्राहक सूची ({customers.length})</h3><input style={s.input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="नाम या मोबाइल से खोजें"/>
      {loading?<p>लोड हो रहा है...</p>:filtered.length===0?<p style={s.muted}>कोई ग्राहक नहीं मिला।</p>:filtered.map(c=><button key={c.id} style={{...s.customer,...(selected?.id===c.id?s.selected:{})}} onClick={()=>void refresh(c)}><span><strong>{c.name}</strong><small>{c.mobile}</small></span><span style={s.arrow}>खाता खोलें →</span></button>)}
    </section>
    {selected&&<div id="customer-ledger-print" className="customer-ledger-print">
      <section style={s.card}><h3 style={s.title}>ग्राहक उधार खाता</h3><h2 style={s.customerName}>{selected.name}</h2><p style={s.muted}>{selected.mobile}{selected.address?` • ${selected.address}`:""}</p>
        <div style={s.balance}><span>वर्तमान बकाया</span><strong>{money(due)}</strong></div>
        <div style={s.printHide}><h4 style={s.title}>नई खरीद / उधार एंट्री</h4>
          <label style={s.label}>एंट्री का प्रकार</label><select style={s.input} value={entryType} onChange={e=>setEntryType(e.target.value as "items"|"amount")}><option value="items">सामान + मात्रा + रेट</option><option value="amount">केवल राशि</option></select>
          <label style={s.label}>खरीद की तारीख</label><input style={s.input} type="date" value={entryDate} onChange={e=>setEntryDate(e.target.value)}/>
          <label style={s.label}>विवरण (वैकल्पिक)</label><input style={s.input} value={description} onChange={e=>setDescription(e.target.value)} placeholder="जैसे शाम की खरीद"/>
          {entryType==="items"?<><label style={s.label}>सामान का नाम</label><input style={s.input} value={itemName} onChange={e=>setItemName(e.target.value)} placeholder="जैसे थाली"/><div style={s.two}><div><label style={s.label}>मात्रा</label><input style={s.input} type="number" min="0.01" step="0.01" value={itemQty} onChange={e=>setItemQty(e.target.value)}/></div><div><label style={s.label}>रेट (₹)</label><input style={s.input} type="number" min="0.01" step="0.01" value={itemRate} onChange={e=>setItemRate(e.target.value)}/></div></div><button style={s.secondary} onClick={addEntryItem}>+ सामान जोड़ें</button>{entryItems.map((it,i)=><div style={s.entry} key={`${it.name}-${i}`}><span>{it.name} — {it.quantity} × {money(it.rate)}</span><strong>{money(it.total)}</strong><button style={s.remove} onClick={()=>setEntryItems(old=>old.filter((_,idx)=>idx!==i))}>×</button></div>)}<p style={s.total}>कुल: {money(entryTotal)}</p></>:<><label style={s.label}>राशि (₹)</label><input style={s.input} type="number" min="0.01" step="0.01" value={manualAmount} onChange={e=>setManualAmount(e.target.value)} placeholder="खरीद की कुल राशि"/></>}
          <button style={s.button} disabled={saving||(entryType==="items"?entryItems.length===0:!manualAmount||Number(manualAmount)<=0)} onClick={()=>void saveEntry()}>{saving?"सेव हो रहा है...":"उधार एंट्री सेव करें"}</button>
          <h4 style={s.title}>भुगतान जमा करें</h4><label style={s.label}>भुगतान की तारीख</label><input style={s.input} type="date" value={payDate} onChange={e=>setPayDate(e.target.value)}/><label style={s.label}>राशि (₹)</label><input style={s.input} type="number" min="0.01" step="0.01" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="जितना भुगतान मिला"/><label style={s.label}>माध्यम</label><select style={s.input} value={payMode} onChange={e=>setPayMode(e.target.value as "cash"|"upi")}><option value="cash">Cash</option><option value="upi">UPI</option></select><label style={s.label}>नोट (वैकल्पिक)</label><input style={s.input} value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder="भुगतान का विवरण"/><button style={s.button} disabled={saving||!payAmount||Number(payAmount)<=0} onClick={()=>void savePayment()}>भुगतान सेव करें</button>
          <button style={s.printButton} onClick={()=>void printCurrentPage(`ग्राहक खाता - ${selected.name}`)}>खाता PDF / Print निकालें</button>
        </div>
        <h4 style={s.title}>तारीखवार हिसाब</h4>
        {rows.length===0?<p style={s.muted}>अभी कोई खरीद या भुगतान एंट्री नहीं है।</p>:<div style={s.tableWrap}><table style={s.table}><thead><tr><th>तारीख</th><th>विवरण</th><th>जमा / खरीद</th><th>भुगतान</th><th>बकाया</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{dateLabel(r.date)}</td><td>{r.description}{r.items?.length?<small style={{display:"block"}}>{r.items.map(it=>`${it.name} (${it.quantity} × ${money(it.rate)})`).join(", ")}</small>:null}</td><td>{r.debit?money(r.debit):"—"}</td><td>{r.credit?money(r.credit):"—"}</td><td>{money(r.balance)}</td></tr>)}</tbody></table></div>}
      </section>
    </div>}
    {selected&&<section style={s.card}><h4 style={s.title}>अलग एडवांस खाता</h4><p style={s.muted}>यह एडवांस बैलेंस उधार खाते से अलग रखा गया है। उपलब्ध एडवांस: <strong>{money(advanceBalance)}</strong></p><label style={s.label}>एडवांस जमा (₹)</label><input style={s.input} type="number" min="0.01" step="0.01" value={advanceAmount} onChange={e=>setAdvanceAmount(e.target.value)}/><label style={s.label}>माध्यम</label><select style={s.input} value={advanceMode} onChange={e=>setAdvanceMode(e.target.value as "cash"|"upi")}><option value="cash">Cash</option><option value="upi">UPI</option></select><label style={s.label}>नोट</label><input style={s.input} value={advanceNote} onChange={e=>setAdvanceNote(e.target.value)}/><button style={s.button} disabled={saving||!advanceAmount||Number(advanceAmount)<=0} onClick={()=>void saveAdvance()}>एडवांस जमा सेव करें</button></section>}
    {error&&<p role="alert" style={s.error}>{error}</p>}{message&&<p style={s.success}>{message}</p>}
    <style>{`@media print { body * { visibility: hidden !important; } #customer-ledger-print, #customer-ledger-print * { visibility: visible !important; } #customer-ledger-print { position:absolute; left:0; top:0; width:100%; background:white !important; } .customer-ledger-print .printHide { display:none !important; } @page { size:A4; margin:12mm; } }`}</style>
  </main>;
}

const s: Record<string,CSSProperties>={page:{padding:16,background:"#f8f3e8",minHeight:"100vh",color:"#49321f"},header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18},heading:{margin:0,fontSize:23},sub:{margin:"5px 0",color:"#80694f"},role:{background:"#ead9b5",padding:"8px 12px",borderRadius:20,fontWeight:700,fontSize:12},card:{background:"#fffdf8",padding:16,borderRadius:14,marginBottom:15,border:"1px solid #e5d6b8"},title:{marginTop:0,color:"#67451f"},label:{display:"block",marginTop:12,marginBottom:6,fontWeight:600},input:{width:"100%",boxSizing:"border-box",padding:12,border:"1px solid #d8c6a5",borderRadius:8,fontSize:15,background:"white",color:"#49321f"},button:{width:"100%",border:0,borderRadius:9,padding:13,marginTop:14,background:"#805326",color:"white",fontWeight:700,fontSize:15},secondary:{width:"100%",border:0,borderRadius:8,padding:11,marginTop:10,background:"#ead9b5",color:"#49321f",fontWeight:700},printButton:{width:"100%",border:"1px solid #805326",borderRadius:9,padding:12,marginTop:12,background:"white",color:"#805326",fontWeight:700},customer:{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,textAlign:"left",padding:12,marginTop:8,border:"1px solid #eadcc3",borderRadius:10,background:"#fffaf0",color:"#49321f"},selected:{border:"2px solid #9b753d",background:"#f7eedc"},arrow:{fontSize:12,color:"#805326",whiteSpace:"nowrap"},muted:{color:"#80694f",fontSize:13},customerName:{margin:"4px 0",fontSize:20},balance:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:14,margin:"14px 0",borderRadius:10,background:"#f1e7d2"},entry:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"8px 0",borderBottom:"1px solid #eee2ce"},two:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10},total:{textAlign:"right",fontWeight:700},remove:{border:0,background:"#f7e1dc",color:"#a33b2b",borderRadius:6},tableWrap:{overflowX:"auto"},table:{width:"100%",borderCollapse:"collapse",fontSize:12},error:{color:"#a33b2b",background:"#fff0ed",padding:12,borderRadius:8},success:{color:"#216b42",background:"#eaf6ee",padding:12,borderRadius:8}};
  
