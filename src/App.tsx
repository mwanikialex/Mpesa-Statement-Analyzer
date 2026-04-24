import { useState } from 'react';
import UploadScreen from './components/UploadScreen';
import Dashboard from './components/Dashboard';
import { Transaction } from './lib/types';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  if (!transactions) {
    return <UploadScreen onParsed={setTransactions} />;
  }

  return <Dashboard transactions={transactions} onReset={() => setTransactions(null)} />;
}
