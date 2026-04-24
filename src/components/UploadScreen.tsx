import React, { useState, useRef } from 'react';
import { UploadCloud, Lock, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { parsePdfStatement } from '../lib/pdfParser';
import { Transaction } from '../lib/types';

export default function UploadScreen({ onParsed }: { onParsed: (transactions: Transaction[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError("");
    setNeedsPassword(false);
    await processFile(selectedFile);
  };

  const processFile = async (f: File, pwd?: string) => {
    setIsProcessing(true);
    setError("");
    try {
      const transactions = await parsePdfStatement(f, pwd);
      onParsed(transactions);
    } catch (err: any) {
      if (err.message === 'PASSWORD_REQUIRED') {
        setNeedsPassword(true);
      } else {
        setError(err.message || 'Failed to parse the PDF. Ensure it is a valid M-Pesa statement.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-[13px]">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden border border-slate-700">
        <div className="p-8 text-center bg-emerald-600 text-white">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-90" />
          <h1 className="text-xl font-bold tracking-tight mb-1">M-Pesa Analyzer</h1>
          <p className="text-emerald-100 text-[11px] uppercase tracking-widest">Statement Upload</p>
        </div>

        <div className="p-8 bg-slate-50">
          {!file || (!needsPassword && error) ? (
            <div 
              className="border border-dashed border-slate-300 rounded bg-white p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                accept="application/pdf"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <UploadCloud className="w-8 h-8 mx-auto text-slate-400 mb-3" />
              <p className="text-slate-700 font-medium mb-1">Click to upload statement</p>
              <p className="text-slate-400 text-[11px]">Valid M-Pesa PDF up to 10MB</p>
            </div>
          ) : needsPassword ? (
            <form onSubmit={(e) => { e.preventDefault(); processFile(file, password); }} className="space-y-4">
              <div className="bg-amber-50 text-amber-800 p-3 rounded text-[11px] flex gap-2 border border-amber-200">
                <Lock className="w-4 h-4 shrink-0" />
                <p>This statement is password protected. Enter your 6-digit unlock code.</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Password (6 digits)</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono tracking-widest"
                  placeholder="------"
                  maxLength={6}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setFile(null); setPassword(''); setNeedsPassword(false); }}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 border border-slate-300 rounded bg-white transition-all w-1/3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !password}
                  className="flex-1 bg-emerald-600 text-white font-medium py-2 rounded hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Unlock & Analyze
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
              <p className="text-slate-600 font-medium">Analyzing your transactions...</p>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 text-red-700 p-3 rounded text-[11px] flex gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
