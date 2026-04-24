import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, CATEGORIES } from '../lib/types';
import { format, isSameDay, startOfWeek, endOfWeek, parseISO, isAfter, isBefore, startOfDay, endOfDay, getDay } from 'date-fns';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Download } from 'lucide-react';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#0ea5e9'];
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Dashboard({ transactions: initialTransactions, onUpdateTransactions, onReset }: { transactions: Transaction[], onUpdateTransactions: (ts: Transaction[]) => void, onReset: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  
  // Advanced Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([0,1,2,3,4,5,6]); // 0=Sun, 1=Mon...

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  const toggleDay = (day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const applyDatePreset = (preset: 'all' | 'this_month' | 'last_month' | 'last_7_days') => {
    const today = new Date();
    if (preset === 'all') {
      setStartDate("");
      setEndDate("");
    } else if (preset === 'this_month') {
      setStartDate(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'last_month') {
      setStartDate(format(new Date(today.getFullYear(), today.getMonth() - 1, 1), 'yyyy-MM-dd'));
      setEndDate(format(new Date(today.getFullYear(), today.getMonth(), 0), 'yyyy-MM-dd'));
    } else if (preset === 'last_7_days') {
      const pastDate = new Date(today);
      pastDate.setDate(pastDate.getDate() - 7);
      setStartDate(format(pastDate, 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    }
  };

  const exportCSV = () => {
    const headers = ['Date', 'Receipt No', 'Details', 'Category', 'Status', 'Amount', 'Balance'];
    const rows = filtered.map(t => {
      const isExpense = t.withdrawn !== 0;
      const amt = isExpense ? -Math.abs(t.withdrawn) : t.paidIn;
      return [
        t.completionTime ? format(t.completionTime, 'yyyy-MM-dd HH:mm:ss') : '',
        t.receiptNo,
        `"${t.details.replace(/"/g, '""')}"`,
        t.category,
        t.status,
        amt,
        t.balance
      ].join(',');
    });
    
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "mpesa_statement_export.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleCategoryChange = (receiptNo: string, newCategory: string) => {
    const updated = transactions.map(t => t.receiptNo === receiptNo ? { ...t, category: newCategory } : t);
    setTransactions(updated);
    onUpdateTransactions(updated);
    setEditingId(null);
  };

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (categoryFilter !== "All" && t.category !== categoryFilter) return false;
      
      const amt = t.withdrawn > 0 ? t.withdrawn : Math.abs(t.withdrawn);
      const actualAmount = amt > 0 ? amt : t.paidIn; // The absolute amount of transaction
      
      if (minAmount && actualAmount < parseFloat(minAmount)) return false;
      if (maxAmount && actualAmount > parseFloat(maxAmount)) return false;
      
      if (t.completionTime) {
          if (startDate && isBefore(t.completionTime, startOfDay(parseISO(startDate)))) return false;
          if (endDate && isAfter(t.completionTime, endOfDay(parseISO(endDate)))) return false;
          
          const dayOfWeek = getDay(t.completionTime);
          if (!selectedDays.includes(dayOfWeek)) return false;
      }

      if (searchTerm) {
          const s = searchTerm.toLowerCase();
          return t.details.toLowerCase().includes(s) || t.receiptNo.toLowerCase().includes(s);
      }
      return true;
    });
  }, [transactions, searchTerm, categoryFilter, startDate, endDate, minAmount, maxAmount, selectedDays]);

  const stats = useMemo(() => {
    let paidIn = 0;
    let withdrawn = 0;
    filtered.forEach(t => {
      paidIn += t.paidIn;
      withdrawn += t.withdrawn > 0 ? t.withdrawn : Math.abs(t.withdrawn);
    });
    return { paidIn, withdrawn, net: paidIn - withdrawn };
  }, [filtered]);

  const categories = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.category))).sort();
  }, [transactions]);

  const expensesByCategory = useMemo(() => {
    const expenses: Record<string, number> = {};
    filtered.forEach(t => {
       const amount = t.withdrawn > 0 ? t.withdrawn : Math.abs(t.withdrawn);
       if (amount > 0) {
           expenses[t.category] = (expenses[t.category] || 0) + amount;
       }
    });
    return Object.entries(expenses).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filtered]);

  // Aggregate by day for chart
  const dailyData = useMemo(() => {
    const days: Record<string, { date: string, income: number, expense: number }> = {};
    filtered.forEach(t => {
        if (!t.completionTime) return;
        const dateStr = format(t.completionTime, 'MMM dd');
        if (!days[dateStr]) days[dateStr] = { date: dateStr, income: 0, expense: 0 };
        days[dateStr].income += t.paidIn;
        days[dateStr].expense += Math.abs(t.withdrawn);
    });
    return Object.values(days);
  }, [filtered]);


  return (
    <div className="h-screen w-full flex overflow-hidden font-sans text-[13px] bg-slate-100">
      {/* Sidebar: Navigation & Primary Filters */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-slate-900 font-bold text-xs">M</div>
            <h1 className="text-white font-semibold text-lg tracking-tight">MPesaLens</h1>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Statement Analyzer</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase mb-3 block">Dynamic Filters</label>
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400">Search text/receipt</span>
                <input type="text" placeholder="e.g. Safaricom" className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400">Category</span>
                <select className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1.5 text-white focus:outline-none focus:border-emerald-500" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                    <option value="All">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400">Min Amount</span>
                  <input type="number" placeholder="0.00" className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500" value={minAmount} onChange={e => setMinAmount(e.target.value)}/>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400">Max Amount</span>
                  <input type="number" placeholder="∞" className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500" value={maxAmount} onChange={e => setMaxAmount(e.target.value)}/>
                </div>
              </div>

              <div className="space-y-1">
                  <div className="flex justify-between items-end mb-1">
                      <span className="text-[11px] text-slate-400">Date Range</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 mb-2">
                      <button onClick={() => applyDatePreset('all')} className="text-[10px] bg-slate-800 border border-slate-700 rounded py-1 hover:bg-slate-700 transition">All Time</button>
                      <button onClick={() => applyDatePreset('last_7_days')} className="text-[10px] bg-slate-800 border border-slate-700 rounded py-1 hover:bg-slate-700 transition">7 Days</button>
                      <button onClick={() => applyDatePreset('this_month')} className="text-[10px] bg-slate-800 border border-slate-700 rounded py-1 hover:bg-slate-700 transition">This Month</button>
                      <button onClick={() => applyDatePreset('last_month')} className="text-[10px] bg-slate-800 border border-slate-700 rounded py-1 hover:bg-slate-700 transition">Last Month</button>
                  </div>
                  <div className="flex gap-2">
                     <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1.5 text-white focus:outline-none focus:border-emerald-500 leading-tight" style={{colorScheme: 'dark'}}/>
                     <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1.5 text-white focus:outline-none focus:border-emerald-500 leading-tight" style={{colorScheme: 'dark'}}/>
                  </div>
              </div>

              <div className="space-y-1">
                  <span className="text-[11px] text-slate-400">Days of Week</span>
                  <div className="flex flex-wrap gap-1">
                      {DAYS_OF_WEEK.map((day, idx) => (
                          <button
                              key={day}
                              onClick={() => toggleDay(idx)}
                              className={`px-1.5 py-1 text-[10px] uppercase font-bold rounded transition-colors ${selectedDays.includes(idx) ? 'bg-emerald-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                          >
                              {day.charAt(0)}
                          </button>
                      ))}
                  </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={onReset} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded shadow-lg transition-colors">
            Analyze New PDF
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-slate-100 overflow-y-auto">
        {/* Header / Summary Stats */}
        <header className="border-b border-slate-200 p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white shrink-0">
          <div className="bg-emerald-50 p-4 border-l-4 border-emerald-500 rounded">
            <div className="text-slate-500 text-[11px] font-bold uppercase">Total Received</div>
            <div className="text-2xl font-bold text-slate-800 mt-1 font-mono tracking-tighter">KES {stats.paidIn.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
          <div className="bg-red-50 p-4 border-l-4 border-red-500 rounded">
            <div className="text-slate-500 text-[11px] font-bold uppercase">Total Spent</div>
            <div className="text-2xl font-bold text-slate-800 mt-1 font-mono tracking-tighter">KES {stats.withdrawn.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
          <div className={`p-4 border-l-4 rounded ${stats.net >= 0 ? 'bg-blue-50 border-blue-500' : 'bg-amber-50 border-amber-500'}`}>
            <div className="text-slate-500 text-[11px] font-bold uppercase">Net Flow</div>
            <div className={`text-2xl font-bold mt-1 font-mono tracking-tighter ${stats.net >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
               {stats.net >= 0 ? '+' : '-'}KES {Math.abs(stats.net).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6 flex-1 flex flex-col">
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
               <div className="bg-white border border-slate-200 rounded-lg p-5 lg:col-span-2">
                   <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">Cashflow Over Time</h3>
                   <div className="h-64">
                       <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={dailyData}>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                               <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                               <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} tickFormatter={(val) => `KES ${val}`} width={65} />
                               <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '12px'}} />
                               <Legend wrapperStyle={{fontSize: '11px', paddingTop: '10px'}}/>
                               <Bar dataKey="income" name="Received" fill="#10b981" radius={[2, 2, 0, 0]} />
                               <Bar dataKey="expense" name="Spent" fill="#ef4444" radius={[2, 2, 0, 0]} />
                           </BarChart>
                       </ResponsiveContainer>
                   </div>
               </div>
               
               <div className="bg-white border border-slate-200 rounded-lg p-5">
                   <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">Expenses Breakdown</h3>
                   <div className="h-64">
                       {expensesByCategory.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                   <Pie
                                       data={expensesByCategory}
                                       innerRadius={50}
                                       outerRadius={75}
                                       paddingAngle={3}
                                       dataKey="value"
                                       stroke="none"
                                   >
                                       {expensesByCategory.map((entry, index) => (
                                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                       ))}
                                   </Pie>
                                   <RechartsTooltip 
                                       formatter={(value: number) => `KES ${value.toLocaleString()}`}
                                       contentStyle={{borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '12px'}}
                                   />
                                   <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '10px', paddingTop: '10px'}}/>
                               </PieChart>
                           </ResponsiveContainer>
                       ) : (
                           <div className="h-full flex items-center justify-center text-slate-400 text-xs">No expenses recorded</div>
                       )}
                   </div>
               </div>
            </div>

            {/* Transactions Grid */}
            <section className="flex-1 flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 min-h-[400px]">
              <div className="flex justify-between items-center p-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  Transaction Ledger
                  <span className="text-[10px] font-normal bg-slate-100 px-2 py-0.5 rounded border text-slate-500">Displaying {filtered.length} results</span>
                </h2>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50 text-[11px] font-medium text-slate-600 transition">
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">Date / Code</th>
                      <th className="px-4 py-3 min-w-[250px]">Recipient / Description</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.length > 0 ? filtered.map((t, i) => {
                       const dateStr = t.completionTime ? format(t.completionTime, 'dd MMM yyyy, HH:mm') : 'Unknown';
                       const isExpense = t.withdrawn !== 0;
                       const amt = isExpense ? Math.abs(t.withdrawn) : t.paidIn;
                       const isIncome = !isExpense;
                       
                       return (
                        <tr key={i} className={`hover:bg-slate-50 ${isIncome ? 'bg-emerald-50/20' : ''}`}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-medium text-slate-700">{dateStr}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{t.receiptNo}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800 max-w-sm truncate" title={t.details}>{t.details}</div>
                            <div className="text-[10px] text-slate-500 italic mt-0.5">Balance: {t.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                          </td>
                          <td className="px-4 py-3">
                            {editingId === t.receiptNo ? (
                                <select 
                                    className="border border-emerald-500 px-1 py-0.5 rounded text-[10px] uppercase font-bold focus:outline-none"
                                    value={t.category}
                                    onChange={(e) => handleCategoryChange(t.receiptNo, e.target.value)}
                                    onBlur={() => setEditingId(null)}
                                    autoFocus
                                >
                                    {Object.values(CATEGORIES).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            ) : (
                                <button 
                                    onClick={() => setEditingId(t.receiptNo)}
                                    className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-bold uppercase truncate max-w-[120px] hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition"
                                >
                                  {t.category}
                                </button>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-emerald-600 flex items-center gap-1">● <span className="text-[11px] text-slate-600">{t.status || 'Completed'}</span></span>
                          </td>
                          <td className={`px-4 py-3 text-right font-mono font-bold whitespace-nowrap ${isIncome ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {isExpense ? '-' : '+'}{amt.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                        </tr>
                       );
                    }) : (
                        <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                                No transactions found matching your filters.
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
        </div>
      </main>
    </div>
  );
}


