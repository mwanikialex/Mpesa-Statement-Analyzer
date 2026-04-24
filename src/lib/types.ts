export interface Transaction {
  receiptNo: string;
  completionTime: Date;
  details: string;
  status: string;
  paidIn: number;
  withdrawn: number;
  balance: number;
  category: string;
}

export const CATEGORIES = {
  TRANSFERS_SENT: 'Transfers (Sent)',
  TRANSFERS_RECEIVED: 'Transfers (Received)',
  BILLS_UTILITIES: 'Bills & Utilities',
  SHOPPING_SPENDS: 'Shopping & Spends',
  BANK_TRANSFERS_OUT: 'Bank Transfers (Out)',
  BANK_TRANSFERS_IN: 'Bank Transfers (In)',
  FEES_CHARGES: 'Fees & Charges',
  LOAN_REPAYMENT: 'Loan Repayment',
  LOAN_RECEIVED: 'Loan/Overdraft (Received)',
  WITHDRAWALS: 'Withdrawals',
  AIRTIME: 'Airtime',
  OTHER_IN: 'Other Incomes',
  OTHER_OUT: 'Other Expenses',
};

export function categorizeTransaction(details: string, amount: number): string {
  const text = details.toLowerCase();

  if (amount < 0) {
    if (text.includes('charge') || text.includes('fee')) return CATEGORIES.FEES_CHARGES;
    if (text.includes('airtime')) return CATEGORIES.AIRTIME;
    if (text.includes('pay bill')) {
      if (text.includes('bank')) return CATEGORIES.BANK_TRANSFERS_OUT;
      return CATEGORIES.BILLS_UTILITIES;
    }
    if (text.includes('merchant payment') || text.includes('buy goods')) return CATEGORIES.SHOPPING_SPENDS;
    if (text.includes('loan repayment') || text.includes('overdraft')) return CATEGORIES.LOAN_REPAYMENT;
    if (text.includes('withdraw') || text.includes('agent')) return CATEGORIES.WITHDRAWALS;
    if (text.includes('customer transfer') || text.includes('send money')) return CATEGORIES.TRANSFERS_SENT;
    if (text.includes('bank')) return CATEGORIES.BANK_TRANSFERS_OUT;
    
    return CATEGORIES.OTHER_OUT;
  } else {
    if (text.includes('funds received') || text.includes('received from')) return CATEGORIES.TRANSFERS_RECEIVED;
    if (text.includes('transfer from bank') || text.includes('from bank')) return CATEGORIES.BANK_TRANSFERS_IN;
    if (text.includes('overdraft') || text.includes('loan')) return CATEGORIES.LOAN_RECEIVED;
    if (text.includes('deposit')) return CATEGORIES.OTHER_IN;
    
    return CATEGORIES.OTHER_IN;
  }
}
