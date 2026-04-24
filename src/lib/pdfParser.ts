import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { Transaction, categorizeTransaction } from './types';
import { parse } from 'date-fns';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function parsePdfStatement(file: File, password?: string): Promise<Transaction[]> {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const doc = await pdfjsLib.getDocument({ 
        data: arrayBuffer, 
        password: password 
    }).promise;

    const transactions: Transaction[] = [];
    let currentTransaction: Transaction | null = null;
    
    // Process pages
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      
      const items = textContent.items.map((item: any) => ({ 
          str: item.str, 
          x: item.transform[4], 
          y: item.transform[5] 
      }));
      
      // Sort vertically (top to bottom), then horizontally (left to right)
      items.sort((a, b) => {
        if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
        return a.x - b.x;
      });

      // Group into rows
      const rows: any[][] = [];
      let currentRow: any[] = [];
      let currentY = -1;
      
      for (const item of items) {
        if (currentY === -1 || Math.abs(currentY - item.y) > 3) {
          if (currentRow.length > 0) rows.push(currentRow);
          currentRow = [item];
          currentY = item.y;
        } else {
          currentRow.push(item);
        }
      }
      if (currentRow.length > 0) rows.push(currentRow);

      for (const row of rows) {
        const strRow = row.map(i => i.str.trim()).filter(s => s);
        if (strRow.length === 0) continue;

        const text = strRow.join(" ");
        // Ignore headers / footers
        if (
          text.includes("M-PESA STATEMENT") ||
          text.includes("Customer Name:") ||
          text.includes("Account Number:") ||
          text.includes("Statement Period:") ||
          text.includes("SUMMARY") ||
          text.includes("DETAILED STATEMENT") ||
          text.match(/Page \d+ of \d+/) ||
          text.includes("Receipt No. Completion Time")
        ) {
          continue;
        }

        const receiptMatch = strRow[0].match(/^[A-Z0-9]{10}$/);
        const timeMatch = strRow.length > 1 && strRow[1].match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

        if (receiptMatch && timeMatch) {
          // Push previous transaction if exists
          if (currentTransaction) {
            transactions.push(currentTransaction);
          }
          
          const statusIndex = strRow.findIndex(s => ['Completed', 'Failed', 'Cancelled'].includes(s));
          if (statusIndex !== -1) {
            const details = strRow.slice(2, statusIndex).join(" ");
            const amounts = strRow.slice(statusIndex + 1);
            
            let paidIn = 0;
            let withdrawn = 0;
            let balance = 0;

            const parseNumber = (s: string) => parseFloat(s.replace(/,/g, ''));

            if (amounts.length >= 2) {
              const amt = parseNumber(amounts[0]);
              balance = parseNumber(amounts[amounts.length - 1]);
              if (amt > 0) {
                paidIn = amt;
              } else {
                withdrawn = amt;
              }
            }

            const amount = paidIn > 0 ? paidIn : withdrawn;
            
            // Parse Date
            let parsedDate = new Date();
            try {
                parsedDate = parse(strRow[1], 'yyyy-MM-dd HH:mm:ss', new Date());
            } catch (e) {
                console.error("Failed to parse date", strRow[1]);
            }

            currentTransaction = {
              receiptNo: strRow[0],
              completionTime: parsedDate,
              details: details,
              status: strRow[statusIndex],
              paidIn,
              withdrawn,
              balance,
              category: categorizeTransaction(details, amount)
            };
          }
        } else if (currentTransaction) {
           currentTransaction.details += " " + text;
           // Recategorize with new details context
           const amount = currentTransaction.paidIn > 0 ? currentTransaction.paidIn : currentTransaction.withdrawn;
           currentTransaction.category = categorizeTransaction(currentTransaction.details, amount);
        }
      }
    }
    
    if (currentTransaction) transactions.push(currentTransaction);

    return transactions;
  } catch (error: any) {
    if (error.name === 'PasswordException') {
        throw new Error('PASSWORD_REQUIRED');
    }
    throw error;
  }
}
