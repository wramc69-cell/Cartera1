
import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, Loader2, RefreshCw, Smartphone, Search, Database, Info, Coins, ShieldAlert } from 'lucide-react';
import { parseImportFile, safeUpper, safeStr } from '../utils/importHelpers';
import { ImportRow, Asset, Position, Broker, User, PortfolioEvent, PortfolioEventType, AssetType, PriceSnapshot, PriceSource } from '../types';
import { SupabaseService } from '../services/supabaseService';
import { PriceService } from '../services/priceService';

interface ImportProps {
  user: User;
  onRefresh: () => void;
}

export const Import: React.FC<ImportProps> = ({ user, onRefresh }) => {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [status, setStatus] = useState<'IDLE' | 'PARSING' | 'PREVIEW' | 'PERSISTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [detectedBrokers, setDetectedBrokers] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({
    totalRows: 0,
    validRows: 0,
    positions: 0,
    cashAdjustments: 0
  });

  useEffect(() => {
    SupabaseService.brokers.listByUser(user.id).then(setBrokers);
  }, [user.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStatus('PARSING');
    setError(null);

    try {
      const parsedRows = await parseImportFile(selectedFile);
      setRows(parsedRows);
      
      const uniqueBrokers = Array.from(new Set(
        parsedRows.map(r => safeUpper(r.broker || 'General'))
      ));
      setDetectedBrokers(uniqueBrokers);
      
      setStatus('PREVIEW');
    } catch (err: any) {
      console.error("Error parsing file:", err);
      setError(
        err.message?.includes('Cannot read properties of undefined') 
        ? "El archivo contiene una cabecera o fila mal estructurada (vacía). Intenta limpiar el archivo Excel."
        : (err.message || "No se pudo leer el archivo. Verifica el formato.")
      );
      setStatus('ERROR');
    }
  };

  const confirmImport = async () => {
    if (rows.length === 0) return;
    setStatus('PERSISTING');
    setImportProgress(0);

    try {
      const brokerMap: Record<string, string> = {};
      const uniqueBrokersStrings = Array.from(new Set(
        rows.map(r => safeUpper(r.broker || 'General'))
      ));

      // 1. Ensure Brokers exist
      for (const bName of (uniqueBrokersStrings as string[])) {
        const existing = brokers.find(b => b.name && safeUpper(b.name) === bName);
        if (existing) {
          brokerMap[bName] = existing.id;
        } else {
          // SupabaseService.brokers.upsert is the correct method
          const newB = await SupabaseService.brokers.upsert({
            userId: user.id,
            name: bName,
            isExternal: true
          }) as any;
          if (newB) {
            brokerMap[bName] = (newB as Broker).id;
          }
        }
      }

      const validRows = rows.filter(r => r.symbol && r.quantity > 0);
      const positionsToUpsert: Position[] = [];
      const cashAdjustments: { broker_id: string; amount: number; concept: string; user_id: string }[] = [];

      setImportStats({
        totalRows: rows.length,
        validRows: validRows.length,
        positions: 0,
        cashAdjustments: 0
      });

      // Position aggregator per symbol+broker
      const posAgg: Record<string, { qty: number; totalCost: number; assetType: AssetType; name: string }> = {};

      validRows.forEach((r: ImportRow) => {
        const symbolKey = safeUpper(r.symbol);
        const brokerKey = safeUpper(r.broker || 'General');
        const key = `${symbolKey}_${brokerKey}`;
        const brokerId = brokerMap[brokerKey];
        
        // Debug Log
        if (r.avgCost === 0 && r.quantity > 0) {
          console.warn(`[IMPORT_DEBUG] Posición con costo 0 para ${symbolKey}`);
        }

        // Robust Cash Detection
        const isCash = r.assetType === AssetType.CASH || 
                      ['CASH', 'EFECTIVO', 'USD', 'LIQUIDEZ', 'DISPONIBLE', 'SALDO', 'MONEDA', 'LIQUIDITY', 'PURCHASING POWER', 'BUYING POWER'].includes(symbolKey) ||
                      ['CASH', 'EFECTIVO', 'LIQUID', 'DISPONIBLE', 'CURRENCY', 'MONEY'].some(alias => safeUpper(r.assetType).includes(alias));

        if (isCash) {
          cashAdjustments.push({
            user_id: user.id,
            broker_id: brokerId,
            amount: r.quantity, // En cash la cantidad es el monto
            concept: 'CASH',
          });
        } else {
          if (!posAgg[key]) {
            posAgg[key] = { qty: 0, totalCost: 0, assetType: r.assetType || AssetType.STOCK, name: r.name || r.symbol };
          }
          posAgg[key].qty += r.quantity;
          posAgg[key].totalCost += (r.quantity * (r.avgCost || 0));
        }
      });

      // 2. Process Assets and Positions
      const aggKeys = Object.keys(posAgg);
      for (let i = 0; i < aggKeys.length; i++) {
        const key = aggKeys[i];
        const [symbol, bName] = key.split('_');
        const agg = posAgg[key];
        const brokerId = brokerMap[bName];
        
        // Upsert Asset
        const asset = await SupabaseService.assets.upsertBatch([{
          symbol,
          name: agg.name,
          assetType: agg.assetType,
          quantity: agg.qty,
          avgCost: agg.qty > 0 ? agg.totalCost / agg.qty : 0,
          currency: 'USD'
        }]);

        if (asset && asset[0]) {
          positionsToUpsert.push({
            id: `pos_${Date.now()}_${i}`,
            userId: user.id,
            assetId: asset[0].id,
            brokerId: brokerId,
            quantity: agg.qty,
            avgCost: agg.qty > 0 ? agg.totalCost / agg.qty : 0,
            source: PriceSource.MARKET,
            asOfDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
        setImportProgress(Math.round(((i + 1) / aggKeys.length) * 80));
      }

      // 3. Persist everything
      if (positionsToUpsert.length > 0) {
        await SupabaseService.positions.bulkUpsert(positionsToUpsert);
      }

      if (cashAdjustments.length > 0) {
        for (const adj of cashAdjustments) {
          await SupabaseService.accountAdjustments.upsert({
            userId: adj.user_id,
            brokerId: adj.broker_id,
            amount: adj.amount,
            concept: 'CASH',
            asOfDate: new Date().toISOString()
          });
        }
      }

      setImportStats(prev => ({
        ...prev,
        positions: positionsToUpsert.length,
        cashAdjustments: cashAdjustments.length
      }));

      setImportProgress(100);
      setStatus('SUCCESS');
      onRefresh();
    } catch (err: any) {
      console.error("Error persisting import:", err);
      setError(err.message || "Error al guardar los datos en la base de datos.");
      setStatus('ERROR');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-fade-in py-10">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-indigo-50 text-[#3a5ba1] text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border border-indigo-100">
          <Database size={14} /> Sistema de Ingesta Masiva
        </div>
        <h1 className="text-5xl font-black text-slate-900 tracking-tight uppercase">Módulo de Importación</h1>
        <p className="text-slate-500 font-medium max-w-2xl mx-auto">Sincroniza tus carteras de Interactive Brokers, Charles Schwab o cualquier Excel personalizado con un solo click.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-8 relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <h3 className="text-xl font-black text-slate-900 uppercase">1. Seleccionar Datos</h3>
              <div 
                className={`border-4 border-dashed rounded-[2rem] p-10 text-center transition-all cursor-pointer ${file ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 hover:border-[#3a5ba1] hover:bg-blue-50/30'}`}
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <input type="file" id="fileInput" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
                <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4 shadow-xl ${file ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border'}`}>
                  {status === 'PARSING' ? <RefreshCw className="animate-spin" size={32} /> : <Upload size={32} />}
                </div>
                <p className="font-black text-slate-900 text-sm uppercase">{file ? file.name : 'Subir Archivo'}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">CSV, Excel (SheetJS)</p>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Guías de Formato</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border">
                    <FileText size={18} className="text-indigo-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-slate-700 uppercase">Columnas Mínimas</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">Ticker, Cantidad, Broker y Costo Promedio (avg_cost).</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border">
                    <Smartphone size={18} className="text-indigo-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-slate-700 uppercase">CASH / Liquidez</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">Símbolos como "USD", "CASH" o "EFECTIVO" se detectan como liquidez.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          {status === 'IDLE' && (
            <div className="h-[500px] bg-white rounded-[3rem] border border-dashed flex flex-col items-center justify-center text-center p-12 text-slate-400">
               <Upload size={64} className="mb-6 opacity-20" />
               <p className="text-xl font-bold italic">Esperando archivo de cartera...</p>
            </div>
          )}

          {status === 'ERROR' && (
            <div className="bg-rose-50 border border-rose-100 p-12 rounded-[3.5rem] text-center space-y-6">
              <div className="w-20 h-20 bg-rose-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                <ShieldAlert size={40} />
              </div>
              <h2 className="text-2xl font-black text-rose-900 uppercase">Fallo en la Lectura</h2>
              <p className="text-rose-700 font-medium max-w-sm mx-auto">{error}</p>
              <button onClick={() => setStatus('IDLE')} className="bg-rose-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-rose-200">Intentar con otro archivo</button>
            </div>
          )}

          {status === 'PREVIEW' && (
            <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden flex flex-col h-[600px]">
              <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase">Vista Previa</h2>
                  <p className="text-xs text-slate-500 font-bold tracking-widest">{rows.length} Instrucciones de Carga Detectadas</p>
                </div>
                <div className="flex gap-2">
                   {detectedBrokers.map(b => (
                     <span key={b} className="px-3 py-1 bg-white border rounded-full text-[10px] font-black text-[#3a5ba1] uppercase shadow-sm">
                       {b}
                     </span>
                   ))}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase text-slate-400 bg-white sticky top-0">
                    <tr>
                      <th className="px-6 py-4">Símbolo</th>
                      <th className="px-6 py-4">Nombre</th>
                      <th className="px-6 py-4">Cantidad</th>
                      <th className="px-6 py-4">Costo Avg</th>
                      <th className="px-6 py-4">Broker</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-900 uppercase">{r.symbol}</td>
                        <td className="px-6 py-4 font-medium text-slate-500 text-xs">{r.name || '---'}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{r.quantity.toLocaleString()}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">
                          {r.avgCost ? `$${r.avgCost.toLocaleString()}` : <span className="text-amber-500 text-[10px] font-black uppercase italic">Sin costo</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black text-[#3a5ba1] uppercase">{r.broker}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-8 bg-slate-900 border-t flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Info className="text-indigo-400" size={20} />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                    Al confirmar, los activos se crearán <br/>y las posiciones se sincronizarán.
                  </p>
                </div>
                <button 
                  onClick={confirmImport}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-3"
                >
                  Procesar Importación <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {status === 'PERSISTING' && (
            <div className="bg-white p-20 rounded-[4rem] border shadow-2xl text-center space-y-10 animate-in fade-in zoom-in">
              <div className="relative inline-block">
                <RefreshCw size={100} className="text-indigo-100 animate-[spin_8s_linear_infinite]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="animate-spin text-[#3a5ba1]" size={48} />
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Sincronizando Base de Datos</h2>
                <p className="text-slate-500 font-medium">Estamos persistiendo tus posiciones de forma segura en la infraestructura cloud.</p>
              </div>
              <div className="max-w-md mx-auto w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${importProgress}%` }} />
              </div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] animate-pulse">Escribiendo registros: {importProgress}%</p>
            </div>
          )}

          {status === 'SUCCESS' && (
            <div className="bg-emerald-50 border-2 border-emerald-100 p-20 rounded-[4rem] text-center space-y-10 animate-in fade-in zoom-in">
              <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-200">
                <CheckCircle size={48} />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-emerald-900 uppercase tracking-tighter">Importación Exitosa</h2>
                <p className="text-emerald-700 font-medium max-w-sm mx-auto">Tu cartera ha sido cargada correctamente y los precios están siendo actualizados en segundo plano.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                <div className="bg-white/50 p-4 rounded-2xl border border-emerald-100 group transition-all hover:bg-emerald-100/50">
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Filas en Archivo</p>
                  <p className="text-2xl font-black text-emerald-600">{importStats.totalRows}</p>
                </div>
                <div className="bg-white/50 p-4 rounded-2xl border border-emerald-100 group transition-all hover:bg-emerald-100/50">
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Filas Válidas</p>
                  <p className="text-2xl font-black text-emerald-600">{importStats.validRows}</p>
                </div>
                <div className="bg-white/50 p-4 rounded-2xl border border-emerald-100 group transition-all hover:bg-emerald-100/50">
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Posiciones Finales</p>
                  <p className="text-2xl font-black text-emerald-600">{importStats.positions}</p>
                </div>
                <div className="bg-white/50 p-4 rounded-2xl border border-emerald-100 group transition-all hover:bg-emerald-100/50">
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Ajustes Efectivo</p>
                  <p className="text-2xl font-black text-emerald-600">{importStats.cashAdjustments}</p>
                </div>
              </div>

              <div className="max-w-md mx-auto space-y-3">
                {importStats.totalRows > importStats.validRows && (
                  <div className="flex items-center gap-3 justify-center text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                    <ShieldAlert size={16} />
                    <p className="text-[10px] font-bold uppercase tracking-wider">
                      {importStats.totalRows - importStats.validRows} filas descartadas (sin símbolo o cantidad ≤ 0).
                    </p>
                  </div>
                )}
                
                {importStats.validRows > (importStats.positions + importStats.cashAdjustments) && (
                  <div className="flex items-center gap-3 justify-center text-indigo-600 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <Info size={16} />
                    <p className="text-[10px] font-bold uppercase tracking-wider">
                      Las filas con el mismo símbolo y broker fueron agrupadas automáticamente.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="#/" className="bg-emerald-600 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-200 transition-all hover:scale-105">Ir al Dashboard</a>
                <button onClick={() => setStatus('IDLE')} className="bg-white text-emerald-600 border-2 border-emerald-100 px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all hover:bg-emerald-100">Nueva Importación</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
