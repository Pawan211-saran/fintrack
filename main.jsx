import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard, WalletCards, ArrowLeftRight, PiggyBank, BarChart3, Settings,
  Bell, Search, Plus, ArrowUpRight, ArrowDownRight, ShoppingBag, Utensils,
  Car, Home, MoreHorizontal, ChevronDown, CalendarDays, Download, Menu, X,
  CheckCircle2, CircleDollarSign, LogOut, LockKeyhole, Mail, UserRound,
  Trash2, AlertTriangle
} from "lucide-react";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const iconFor = { Food:Utensils, Shopping:ShoppingBag, Transport:Car, Housing:Home, Income:CircleDollarSign };

function money(n){ return "₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2}); }

async function api(path, options={}, token){
  const res=await fetch(`${API}${path}`,{
    ...options,
    headers:{"Content-Type":"application/json",...(options.headers||{}),...(token?{Authorization:`Bearer ${token}`}:{})}
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message||"Something went wrong.");
  return data;
}

function AuthScreen({onAuth}){
  const [mode,setMode]=useState("login");
  const [form,setForm]=useState({name:"",email:"",password:""});
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  async function submit(e){
    e.preventDefault(); setError(""); setLoading(true);
    try{
      const data=await api(`/auth/${mode==="login"?"login":"signup"}`,{method:"POST",body:JSON.stringify(form)});
      localStorage.setItem("fintrack-token",data.token); onAuth(data);
    }catch(e){setError(e.message)}finally{setLoading(false)}
  }
  return <div className="auth-shell">
    <div className="auth-brand"><div className="brand-mark"><WalletCards size={22}/></div><span>Fin<span>Track</span></span></div>
    <div className="auth-card">
      <div className="auth-visual"><div className="auth-orb">₹</div><h1>Take control of<br/><span>your money.</span></h1><p>Track expenses, manage budgets and understand your finances in one simple dashboard.</p><div className="auth-mini"><div><strong>100%</strong><small>Your data is yours</small></div><div><strong>24/7</strong><small>Finance overview</small></div></div></div>
      <div className="auth-form">
        <div className="auth-tabs"><button className={mode==="login"?"selected":""} onClick={()=>{setMode("login");setError("")}}>Login</button><button className={mode==="signup"?"selected":""} onClick={()=>{setMode("signup");setError("")}}>Create account</button></div>
        <h2>{mode==="login"?"Welcome back":"Create your account"}</h2><p className="auth-sub">{mode==="login"?"Login to continue to your dashboard.":"Start managing your finances today."}</p>
        {error&&<div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          {mode==="signup"&&<label><span><UserRound size={14}/> Full name</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" required /></label>}
          <label><span><Mail size={14}/> Email</span><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" required /></label>
          <label><span><LockKeyhole size={14}/> Password</span><input type="password" minLength="6" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Minimum 6 characters" required /></label>
          {mode==="login"&&<div className="auth-help">Your account is protected with a hashed password and session token.</div>}
          <button className="primary auth-submit" disabled={loading}>{loading?"Please wait...":mode==="login"?"Login to FinTrack":"Create account"}</button>
        </form>
      </div>
    </div>
  </div>
}

function App(){
  const [token,setToken]=useState(()=>localStorage.getItem("fintrack-token"));
  const [user,setUser]=useState(null);
  const [loading,setLoading]=useState(Boolean(token));
  const [error,setError]=useState("");
  const [active,setActive]=useState("Overview");
  const [transactions,setTransactions]=useState([]);
  const [budgets,setBudgets]=useState([]);
  const [reports,setReports]=useState({summary:{income:0,expense:0},categories:[]});
  const [showAdd,setShowAdd]=useState(false),[showBudget,setShowBudget]=useState(false);
  const [mobileOpen,setMobileOpen]=useState(false),[showNotifications,setShowNotifications]=useState(false);
  const [search,setSearch]=useState(""),[typeFilter,setTypeFilter]=useState("all"),[catFilter,setCatFilter]=useState("all");
  const [form,setForm]=useState({title:"",amount:"",category:"Food",type:"expense",date:new Date().toISOString().slice(0,10)});
  const [budgetForm,setBudgetForm]=useState({name:"Food",limit:""});

  const logout=()=>{localStorage.removeItem("fintrack-token");setToken(null);setUser(null)};
  async function loadAll(t=token){
    try{
      const [me,tx,bg,rp]=await Promise.all([api("/auth/me",{},t),api("/transactions",{},t),api("/budgets",{},t),api("/reports",{},t)]);
      setUser(me.user);setTransactions(tx.transactions);setBudgets(bg.budgets);setReports(rp);
    }catch(e){if(e.message.includes("Session")||e.message.includes("Authentication"))logout();else setError(e.message)}
    finally{setLoading(false)}
  }
  useEffect(()=>{if(token)loadAll(token);},[token]);

  const income=reports.summary?.income||0, expense=reports.summary?.expense||0, balance=income-expense;
  const budgetData=budgets.map(b=>({...b,spent:transactions.filter(t=>t.type==="expense"&&t.category===b.name).reduce((s,t)=>s+Number(t.amount),0)}));
  const totalBudget=budgetData.reduce((s,b)=>s+Number(b.limit),0), totalSpent=budgetData.reduce((s,b)=>s+b.spent,0);
  const categories=[...new Set(transactions.map(t=>t.category))];
  const filtered=useMemo(()=>transactions.filter(t=>(!search||`${t.title} ${t.category}`.toLowerCase().includes(search.toLowerCase()))&&(typeFilter==="all"||t.type===typeFilter)&&(catFilter==="all"||t.category===catFilter)),[transactions,search,typeFilter,catFilter]);

  async function addTransaction(e){
    e.preventDefault();
    try{await api("/transactions",{method:"POST",body:JSON.stringify(form)},token);setForm({title:"",amount:"",category:"Food",type:"expense",date:new Date().toISOString().slice(0,10)});setShowAdd(false);await loadAll()}
    catch(e){setError(e.message)}
  }
  async function deleteTransaction(id){if(!confirm("Delete this transaction?"))return;try{await api(`/transactions/${id}`,{method:"DELETE"},token);await loadAll()}catch(e){setError(e.message)}}
  async function saveBudget(e){e.preventDefault();try{await api("/budgets",{method:"POST",body:JSON.stringify(budgetForm)},token);setBudgetForm({name:"Food",limit:""});setShowBudget(false);await loadAll()}catch(e){setError(e.message)}}
  async function deleteBudget(id){if(!confirm("Delete this budget?"))return;try{await api(`/budgets/${id}`,{method:"DELETE"},token);await loadAll()}catch(e){setError(e.message)}}

  if(loading)return <div className="loading-screen"><div className="brand-mark"><WalletCards size={22}/></div><strong>Loading FinTrack...</strong></div>;
  if(!token||!user)return <AuthScreen onAuth={data=>{setToken(data.token);setUser(data.user)}}/>;

  const nav=[["Overview",LayoutDashboard],["Transactions",ArrowLeftRight],["Budgets",PiggyBank],["Reports",BarChart3]];
  return <div className="app">
    <aside className={"sidebar "+(mobileOpen?"open":"")}>
      <div className="brand"><div className="brand-mark"><WalletCards size={20}/></div><span>Fin<span>Track</span></span><button className="close-mobile" onClick={()=>setMobileOpen(false)}><X/></button></div>
      <div className="menu-label">MENU</div><nav>{nav.map(([name,Icon])=><button key={name} className={"nav-item "+(active===name?"active":"")} onClick={()=>{setActive(name);setMobileOpen(false)}}><Icon size={19}/><span>{name}</span></button>)}</nav>
      <div className="menu-label bottom-label">ACCOUNT</div><button className="nav-item"><Settings size={19}/><span>Settings</span></button>
      <div className="upgrade"><div className="upgrade-icon"><PiggyBank size={18}/></div><strong>Build better money habits</strong><p>Track your spending and stay on budget.</p><button onClick={()=>setShowAdd(true)}>Add expense <Plus size={15}/></button></div>
      <div className="user-card"><div className="avatar">{user.name.slice(0,2).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.email}</small></div><button className="logout-mini" onClick={logout} title="Logout"><LogOut size={15}/></button></div>
    </aside>
    {mobileOpen&&<div className="overlay" onClick={()=>setMobileOpen(false)}/>}
    <main className="main">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMobileOpen(true)}><Menu size={22}/></button><div><h1>{active}</h1><p>Good to see you, {user.name.split(" ")[0]}. Here's your financial overview.</p></div><div className="top-actions"><div className="search"><Search size={18}/><input placeholder="Search..." value={search} onChange={e=>{setSearch(e.target.value);setActive("Transactions")}}/></div><button className="icon-btn" onClick={()=>setShowNotifications(!showNotifications)}><Bell size={19}/>{expense>0&&<i/>}</button><button className="profile-avatar">{user.name.slice(0,2).toUpperCase()}</button>{showNotifications&&<div className="notification-pop"><strong>Notifications</strong><p>{budgetData.filter(b=>b.spent>b.limit).length? "You have an over-budget category.":"You're on track with your budgets."}</p></div>}</div></header>
      {error&&<div className="error-banner"><AlertTriangle size={16}/>{error}<button onClick={()=>setError("")}><X size={15}/></button></div>}

      {active==="Overview"&&<><section className="hero-row"><div><span className="eyebrow">TOTAL BALANCE</span><div className="balance">{money(balance)}</div><div className="positive"><ArrowUpRight size={15}/> {income?Math.round(balance/income*100):0}% <span>current savings rate</span></div></div><button className="primary" onClick={()=>setShowAdd(true)}><Plus size={18}/> Add transaction</button></section>
      <section className="stats"><Stat icon={ArrowUpRight} label="Income" value={income} note="From your transactions" positive/><Stat icon={ArrowDownRight} label="Expenses" value={expense} note="From your transactions"/><Stat icon={PiggyBank} label="Savings" value={Math.max(balance,0)} note="Income minus expenses" positive/><Stat icon={WalletCards} label="Budget left" value={Math.max(totalBudget-totalSpent,0)} note={`${budgetData.length} active budgets`}/></section>
      <section className="grid"><div className="panel spending-panel"><div className="panel-head"><div><h2>Spending overview</h2><p>Your real transaction summary</p></div><button className="select"><CalendarDays size={15}/> This account</button></div><div className="report-bars">{reports.categories.length?reports.categories.slice(0,6).map((item) => null):null}<div className="simple-chart"><div style={{height:`${Math.min(100,expense?40:8)}%`}}/><div style={{height:`${Math.min(100,income?75:8)}%`}}/></div><div className="chart-labels"><span>Expenses</span><span>Income</span></div></div><div className="legend"><span><i className="dot expense-dot"/> Expenses {money(expense)}</span><span><i className="dot income-dot"/> Income {money(income)}</span></div></div>
      <div className="panel budget-panel"><div className="panel-head"><div><h2>Budget progress</h2><p>Live from your transactions</p></div><button className="more" onClick={()=>setShowBudget(true)}><Plus size={18}/></button></div><div className="budget-total"><strong>{money(totalSpent)}</strong><span> spent of {money(totalBudget)}</span></div>{budgetData.slice(0,3).map(b=><Budget key={b.id} {...b}/>) }{!budgetData.length&&<Empty text="No budgets yet."/>}<button className="outline" onClick={()=>setActive("Budgets")}>Manage budgets</button></div></section>
      <section className="panel transactions"><div className="panel-head"><div><h2>Recent transactions</h2><p>Your latest income and expenses</p></div><button className="text-btn" onClick={()=>setActive("Transactions")}>View all <ArrowUpRight size={15}/></button></div><TransactionTable transactions={transactions.slice(0,5)} onDelete={deleteTransaction}/></section></>}

      {active==="Transactions"&&<section className="panel page-panel"><div className="page-actions"><div><h2>All transactions</h2><p>Search and filter your personal records.</p></div><button className="primary" onClick={()=>setShowAdd(true)}><Plus size={18}/> Add transaction</button></div><div className="filters"><div className="filter-search"><Search size={15}/><input placeholder="Search transactions..." value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select><select value={catFilter} onChange={e=>setCatFilter(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select><button className="outline clear-filter" onClick={()=>{setSearch("");setTypeFilter("all");setCatFilter("all")}}>Clear</button></div><TransactionTable transactions={filtered} onDelete={deleteTransaction}/></section>}

      {active==="Budgets"&&<section className="page-panel"><div className="page-actions"><div><h2>Your budgets</h2><p>Set limits and automatically track category spending.</p></div><button className="primary" onClick={()=>setShowBudget(true)}><Plus size={18}/> Add budget</button></div><div className="budget-cards">{budgetData.map(b=><div className="big-budget" key={b.id}><div className="budget-title"><span>{b.name}</span><strong>{money(b.spent)} / {money(b.limit)}</strong></div><div className="progress"><span style={{width:Math.min(100,b.spent/b.limit*100)+"%"}}/></div><div className="budget-foot"><small>{b.spent>b.limit?"Over budget by "+money(b.spent-b.limit):money(b.limit-b.spent)+" remaining"}</small><button className="delete-budget" onClick={()=>deleteBudget(b.id)}><Trash2 size={14}/></button></div></div>)}</div>{!budgetData.length&&<div className="empty-large"><PiggyBank/><strong>No budgets yet</strong><p>Create your first category budget.</p></div>}</section>}

      {active==="Reports"&&<section className="panel page-panel"><div className="page-actions"><div><h2>Financial report</h2><p>Calculated from your account data.</p></div><button className="outline" onClick={()=>exportCSV(transactions)}><Download size={16}/> Export CSV</button></div><div className="report-grid"><div><span>Income</span><strong>{money(income)}</strong></div><div><span>Expenses</span><strong>{money(expense)}</strong></div><div><span>Net savings</span><strong>{money(balance)}</strong></div></div><div className="category-report"><h3>Spending by category</h3>{reports.categories.length?reports.categories.map(c=><div className="category-row" key={c.category}><span>{c.category}</span><div className="progress"><span style={{width:`${expense?Math.min(100,c.amount/expense*100):0}%`}}/></div><strong>{money(c.amount)}</strong></div>):<Empty text="No expense data yet."/>}</div><div className="report-note"><CheckCircle2 size={20}/><div><strong>Private account</strong><p>Your reports are generated from your authenticated database records.</p></div></div></section>}
    </main>

    {showAdd&&<Modal title="Add transaction" subtitle="Save it directly to your account." close={()=>setShowAdd(false)}><form onSubmit={addTransaction}><label>Type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Description<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Grocery shopping" required/></label><label>Amount<input type="number" min="1" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0" required/></label>{form.type==="expense"&&<label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option>Food</option><option>Shopping</option><option>Transport</option><option>Housing</option><option>Entertainment</option><option>Health</option><option>Other</option></select></label>}<label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><button className="primary submit">Save transaction</button></form></Modal>}
    {showBudget&&<Modal title="Add / update budget" subtitle="Use the same category to update its limit." close={()=>setShowBudget(false)}><form onSubmit={saveBudget}><label>Category<select value={budgetForm.name} onChange={e=>setBudgetForm({...budgetForm,name:e.target.value})}><option>Food</option><option>Shopping</option><option>Transport</option><option>Housing</option><option>Entertainment</option><option>Health</option><option>Other</option></select></label><label>Monthly limit<input type="number" min="1" value={budgetForm.limit} onChange={e=>setBudgetForm({...budgetForm,limit:e.target.value})} placeholder="10000" required/></label><button className="primary submit">Save budget</button></form></Modal>}
  </div>
}

function Stat({icon:Icon,label,value,note,positive}){return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={17}/></div></div><strong>{money(value)}</strong><small className={positive?"green":""}>{note}</small></div>}
function Budget({name,spent,limit}){return <div className="budget"><div className="budget-line"><span>{name}</span><strong>{money(spent)} <em>/ {money(limit)}</em></strong></div><div className="progress"><span style={{width:Math.min(100,spent/limit*100)+"%"}}/></div></div>}
function Empty({text}){return <div className="empty">{text}</div>}
function TransactionTable({transactions,onDelete}){return <div className="table-wrap"><table><thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th className="amount-head">Amount</th></tr></thead><tbody>{transactions.map(t=>{const Icon=iconFor[t.category]||MoreHorizontal;return <tr key={t.id}><td><div className="transaction-name"><div className={"tx-icon "+t.type}><Icon size={17}/></div><strong>{t.title}</strong></div></td><td><span className="category">{t.category}</span></td><td>{t.date}</td><td className={"amount "+t.type}>{t.type==="income"?"+":"-"}{money(t.amount)} <button className="delete-btn" title="Delete" onClick={()=>onDelete(t.id)}>×</button></td></tr>})}</tbody></table>{!transactions.length&&<div className="empty">No transactions found.</div>}</div>}
function Modal({title,subtitle,close,children}){return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="close" onClick={close}><X/></button></div>{children}</div></div>}
function exportCSV(rows){const header="Title,Category,Type,Amount,Date\n";const body=rows.map(r=>[r.title,r.category,r.type,r.amount,r.date].map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");const blob=new Blob([header+body],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="fintrack-transactions.csv";a.click();URL.revokeObjectURL(a.href)}
createRoot(document.getElementById("root")).render(<App/>);
