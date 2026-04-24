import { useState, useEffect } from 'react';
import UploadScreen from './components/UploadScreen';
import Dashboard from './components/Dashboard';
import { Transaction } from './lib/types';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(() => {
    // Attempt to load from localStorage on mount
    const saved = localStorage.getItem('mpesa_transactions');
    if (saved) {
      try {
        const parsed: Transaction[] = JSON.parse(saved);
        // Correct date formats back to Date objects
        return parsed.map(t => ({
          ...t,
          completionTime: new Date(t.completionTime)
        }));
      } catch (e) {
        console.error('Failed to parse saved transactions', e);
      }
    }
    return null;
  });

  useEffect(() => {
    if (transactions) {
      localStorage.setItem('mpesa_transactions', JSON.stringify(transactions));
    } else {
      localStorage.removeItem('mpesa_transactions');
    }
  }, [transactions]);

  const handleReset = () => {
    setTransactions(null);
  };

  if (!transactions) {
    return <UploadScreen onParsed={setTransactions} />;
  }

  return <Dashboard transactions={transactions} onUpdateTransactions={setTransactions} onReset={handleReset} />;
}
