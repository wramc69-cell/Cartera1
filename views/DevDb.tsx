
import React, { useState } from 'react';
import { Database, Table, ArrowLeft, RefreshCw, Layers, Zap, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { User, Asset, Position, Broker, PortfolioEvent, BrokerBalance } from '../types';
import * as Mocks from '../constants';
import { supabase } from '../lib/supabase';

interface DiagnosticResult {
  module: string;
  success: boolean;
  message: string;
  code?: string;
  status?: number;
  duration: number;
}

interface DevDbProps {
  assets: Asset[];
  positions: Position[];
  brokers: Broker[];
  portfolioEvents: PortfolioEvent[];
  balances: BrokerBalance[];
}

export const DevDb: React.FC<DevDbProps> = ({ assets, positions, brokers, portfolioEvents, balances }) => {
  const [selectedTable, setSelectedTable] = useState<string>('Asset');
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [testing, setTesting] = useState(false);

  const runConnectivityTest = async () => {
    setTesting(true);
    setDiagnostics([]);
    
    const queries = [
      { name: 'profiles (limit 1)', table: 'profiles' },
      { name: 'assets (limit 1)', table: 'assets' },
      { name: 'brokers (limit 1)', table: 'brokers' }
    ];

    const results: DiagnosticResult[] = [];

    for (const q of queries) {
      const start = Date.now();
      try {
        console.log(`[TEST] Corriendo query directa para ${q.table}...`);
        const { data, error, status } = await supabase.from(q.table).select('id').limit(1);
        const end = Date.now();
        
        if (error) {
          results.push({
            module: q.name,
            success: false,
            message: error.message,
            code: error.code,
            status: status,
            duration: end - start
          });
        } else {
          results.push({
            module: q.name,
            success: true,
            message: data ? 'Datos recibidos correctamente' : 'Sin datos, pero conexión exitosa',
            status: status,
            duration: end - start
          });
        }
      } catch (err: any) {
        results.push({
          module: q.name,
          success: false,
          message: err.message || 'Error desconocido atrapado en catch',
          duration: Date.now() - start
        });
      }
    }
    
    setDiagnostics(results);
    setTesting(false);
  };

  const tables = [
    { name: 'Broker', data: brokers },
    { name: 'BrokerBalance', data: balances },
    { name: 'Asset', data: assets },
    { name: 'Position', data: positions },
    { name: 'PortfolioEvent', data: portfolioEvents },
    { name: 'DividendEvent', data: Mocks.MOCK_DIVIDENDS },
    { name: 'AlertRule', data: Mocks.MOCK_ALERTS },
  ];

  const currentData = tables.find(t => t.name === selectedTable)?.data || [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <header className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-3">
            <Database className="text-indigo-400" size={32} />
            <div>
              <h1 className="text-2xl font-bold">Database Inspector</h1>
              <p className="text-slate-400 text-sm">SQLite Management Console (Dev Only)</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => { localStorage.clear(); window.location.href = '/'; }}
          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-rose-900/40"
        >
          <RefreshCw size={18} />
          Wipe Local Storage
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="space-y-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 px-3">Tablas del Sistema</h3>
          {tables.map(table => (
            <button
              key={table.name}
              onClick={() => setSelectedTable(table.name)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold
                ${selectedTable === table.name ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-100'}
              `}
            >
              <Table size={18} />
              {table.name}
              <span className="ml-auto text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-mono">
                {table.data.length}
              </span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 space-y-6">
          {/* Connectivity Test Panel */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                      <Zap className="text-indigo-400" size={20} />
                   </div>
                   <div>
                      <h3 className="font-bold text-lg">Prueba de Conectividad</h3>
                      <p className="text-xs text-slate-500">Queries directas a Supabase (sin timeout wrapper)</p>
                   </div>
                </div>
                <button 
                  onClick={runConnectivityTest}
                  disabled={testing}
                  className="bg-[#3a5ba1] hover:bg-[#2d4680] disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  {testing ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                  Probar conexión Supabase
                </button>
             </div>

             {diagnostics.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   {diagnostics.map((res, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border ${res.success ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'} space-y-3`}>
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-slate-400">{res.module}</span>
                            {res.success ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-rose-400" />}
                         </div>
                         <div className="flex items-center gap-2 text-indigo-400">
                            <Clock size={14} />
                            <span className="text-xs font-mono font-bold">{res.duration}ms</span>
                         </div>
                         <p className={`text-[10px] leading-relaxed ${res.success ? 'text-emerald-300/70' : 'text-rose-300'}`}>
                            {res.message}
                         </p>
                         {!res.success && (
                            <div className="text-[9px] font-mono opacity-60">
                               {res.code && <div>Code: {res.code}</div>}
                               {res.status && <div>Status: {res.status}</div>}
                            </div>
                         )}
                      </div>
                   ))}
                </div>
             )}
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-indigo-400" />
                <span className="font-bold text-slate-200">{selectedTable}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 tracking-wider">RAW JSON DATA VIEW</span>
            </div>
            
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/50 text-slate-500 sticky top-0">
                  <tr>
                    {currentData.length > 0 && Object.keys(currentData[0]).map(key => (
                      <th key={key} className="px-6 py-4 font-bold border-b border-slate-700 uppercase text-[9px] tracking-widest">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {currentData.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                      {Object.values(row).map((val: any, j: number) => (
                        <td key={j} className="px-6 py-4 text-slate-400 whitespace-nowrap">
                          {typeof val === 'object' ? JSON.stringify(val).slice(0, 30) + '...' : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {currentData.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-20 text-center text-slate-600 italic">
                        No hay registros en esta tabla.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 font-mono">
            <h4 className="font-bold mb-2 text-indigo-400 text-xs uppercase tracking-widest">Query Preview</h4>
            <code className="text-[11px] text-slate-500 block leading-relaxed">
              SELECT * FROM public.{selectedTable.toLowerCase()} LIMIT 50;
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
