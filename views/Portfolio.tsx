
import React, { useMemo, useState } from 'react';
import { Asset, Position, Broker, AssetType, PortfolioEvent, PortfolioEventType, User, PriceSource, BrokerBalance, PriceSnapshot } from '../types';
import { Plus, Search, Filter, ArrowUpRight, ArrowDownRight, Building2, ChevronRight, Briefcase, X, Sparkles, Loader2, Download, FileSpreadsheet, FileText, FileBadge, Info, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PortfolioService } from '../services/portfolioService';
import { enrichAssetData } from '../utils/portfolioUtils';

interface PortfolioProps {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  positions: Position[];
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  brokers: Broker[];
  balances: BrokerBalance[];
  snapshots: PriceSnapshot[];
  setPortfolioEvents: React.Dispatch<React.SetStateAction<PortfolioEvent[]>>;
  user: User;
}

export const Portfolio: React.FC<PortfolioProps> = ({ 
  assets, setAssets, positions, setPositions, brokers, balances, snapshots, setPortfolioEvents, user 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Add Asset Form State
  const [newAsset, setNewAsset] = useState({
    symbol: '',
    name: '',
    type: AssetType.STOCK,
    quantity: '',
    avgCost: '',
    brokerId: ''
  });

  const { assetDetails } = useMemo(() => 
    PortfolioService.getSummary(assets, positions, brokers, balances, snapshots), 
    [assets, positions, brokers, balances, snapshots]
  );

  const filteredAssets = useMemo(() => {
    return assetDetails
      .filter(a => a.quantity > 0)
      .filter(a => a.assetType !== AssetType.CASH) // Excluir CASH de la tabla de activos accionarios
      .filter(a => 
        a.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.sector?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [assetDetails, searchTerm]);

  const handleSymbolChange = (symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    const enrichment = enrichAssetData(upperSymbol);
    setNewAsset(prev => ({
      ...prev,
      symbol: upperSymbol,
      name: enrichment.name,
      type: enrichment.type,
      avgCost: prev.avgCost || enrichment.price.toString()
    }));
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assets.length >= 150 && !assets.find(a => a.symbol === newAsset.symbol)) {
      alert("Límite de 150 activos alcanzado. No puedes añadir más símbolos únicos en el MVP.");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const qty = parseFloat(newAsset.quantity);
    const cost = parseFloat(newAsset.avgCost);
    const date = new Date().toISOString();

    let updatedAssets = [...assets];
    let updatedPositions = [...positions];
    let assetId = '';

    // 1. Handle Asset
    const existingAsset = updatedAssets.find(a => a.symbol === newAsset.symbol);
    if (existingAsset) {
      assetId = existingAsset.id;
    } else {
      assetId = `asset_${Date.now()}`;
      const newAssetObj: Asset = {
        id: assetId,
        symbol: newAsset.symbol,
        name: newAsset.name,
        assetType: newAsset.type,
        currency: 'USD',
        isDividendAsset: newAsset.type !== AssetType.CRYPTO && newAsset.type !== AssetType.CASH,
        quantity: 0,
        avgCost: 0,
        currentPrice: cost // Initial price same as cost
      };
      updatedAssets.push(newAssetObj);
    }

    // 2. Handle Position
    const existingPosIdx = updatedPositions.findIndex(p => p.assetId === assetId && p.brokerId === newAsset.brokerId);
    const isManualTicker = ['ASHFIXA', 'VALSHTA'].includes(newAsset.symbol.toUpperCase());

    if (existingPosIdx !== -1) {
      const p = updatedPositions[existingPosIdx];
      const totalQty = p.quantity + qty;
      const totalCost = (p.quantity * p.avgCost) + (qty * cost);
      updatedPositions[existingPosIdx] = {
        ...p,
        quantity: totalQty,
        avgCost: totalCost / totalQty,
        priceSource: isManualTicker ? PriceSource.MANUAL : p.priceSource,
        manualPrice: isManualTicker ? cost : p.manualPrice,
        updatedAt: date
      };
    } else {
      updatedPositions.push({
        id: `pos_${Date.now()}`,
        userId: user.id,
        assetId,
        brokerId: newAsset.brokerId,
        quantity: qty,
        avgCost: cost,
        priceSource: isManualTicker ? PriceSource.MANUAL : PriceSource.MARKET,
        manualPrice: isManualTicker ? cost : undefined,
        createdAt: date,
        updatedAt: date
      });
    }

    // 3. Sync Asset Total Qty and Avg Cost
    const assetIdx = updatedAssets.findIndex(a => a.id === assetId);
    const allAssetPositions = updatedPositions.filter(p => p.assetId === assetId);
    const totalAssetQty = allAssetPositions.reduce((sum, p) => sum + p.quantity, 0);
    const totalAssetValue = allAssetPositions.reduce((sum, p) => sum + (p.quantity * p.avgCost), 0);
    
    updatedAssets[assetIdx] = {
      ...updatedAssets[assetIdx],
      quantity: totalAssetQty,
      avgCost: totalAssetValue / totalAssetQty
    };

    // 4. Record Event
    const newEvent: PortfolioEvent = {
      id: `event_${Date.now()}`,
      userId: user.id,
      assetId,
      brokerId: newAsset.brokerId,
      date,
      type: PortfolioEventType.BUY,
      quantityDelta: qty,
      priceUsed: cost,
      note: 'Añadido manualmente desde vista de activos'
    };

    setAssets(updatedAssets);
    setPositions(updatedPositions);
    setPortfolioEvents(prev => [newEvent, ...prev]);
    
    setIsSubmitting(false);
    setIsAddModalOpen(false);
    setNewAsset({
      symbol: '',
      name: '',
      type: AssetType.STOCK,
      quantity: '',
      avgCost: '',
      brokerId: ''
    });
  };

  const exportData = (format: 'xlsx' | 'csv' | 'pdf') => {
    const data = filteredAssets.map(a => ({
      Simbolo: a.symbol,
      Activo: a.name,
      Tipo: a.assetType,
      Sector: a.sector || 'N/A',
      Cantidad: a.quantity,
      'Precio Actual': a.currentPrice,
      'Costo Promedio': a.avgCost,
      'Valor Total': a.totalValue,
      'Profit/Loss': a.pnl,
      'P/L %': `${a.pnlPercent.toFixed(2)}%`
    }));

    if (format === 'xlsx' || format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Cartera");
      XLSX.writeFile(workbook, `mi_cartera.${format}`);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      doc.text("Resumen de Cartera - Control de Cartera", 14, 15);
      
      const tableHeaders = [['Simbolo', 'Activo', 'Cant', 'Precio', 'Valor', 'P/L %']];
      const tableData = filteredAssets.map(a => [
        a.symbol,
        a.name,
        a.quantity.toLocaleString(),
        `$${a.currentPrice.toLocaleString()}`,
        `$${a.totalValue.toLocaleString()}`,
        `${a.pnlPercent >= 0 ? '+' : ''}${a.pnlPercent.toFixed(2)}%`
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableData,
        startY: 25,
        theme: 'striped',
        headStyles: { fillColor: [58, 91, 161] }
      });

      doc.save("mi_cartera.pdf");
    }
    setShowExportOptions(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-[800] text-slate-900 dark:text-white tracking-tight">Tus Activos</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Control total sobre tus posiciones individuales y su rendimiento histórico.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#3a5ba1] hover:bg-[#2d4680] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#3a5ba1]/20 active:scale-95"
        >
          <Plus size={20} />
          Añadir Activo
        </button>
      </header>

      <div className="bg-white dark:bg-slate-900/50 rounded-[2.5rem] border dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por ticker, nombre o sector..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-4 focus:ring-[#3a5ba1]/10 focus:border-[#3a5ba1] bg-white dark:bg-slate-900 transition-all text-sm font-medium dark:text-white"
              aria-label="Buscar activos"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button 
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="px-5 py-3 border rounded-2xl flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 font-bold text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              >
                <Download size={18} />
                Exportar
              </button>

              {showExportOptions && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button 
                    onClick={() => exportData('xlsx')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <FileSpreadsheet size={16} className="text-emerald-500" />
                    Excel (.xlsx)
                  </button>
                  <button 
                    onClick={() => exportData('csv')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <FileText size={16} className="text-blue-500" />
                    CSV (.csv)
                  </button>
                  <button 
                    onClick={() => exportData('pdf')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <FileBadge size={16} className="text-rose-500" />
                    PDF (.pdf)
                  </button>
                </div>
              )}
            </div>

            <button className="px-5 py-3 border rounded-2xl flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 font-bold text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
              <Filter size={18} />
              Filtrar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left" role="table">
            <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.15em] border-b dark:border-slate-800">
              <tr>
                <th className="px-6 py-5">Identificador</th>
                <th className="px-6 py-5">Plataforma</th>
                <th className="px-6 py-5">Unidades</th>
                <th className="px-6 py-5">Precio / Costo</th>
                <th className="px-6 py-5">Valoración</th>
                <th className="px-6 py-5">Profit / Loss</th>
                <th className="px-6 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all group" role="row">
                  <td className="px-6 py-5">
                    <Link to={`/assets/${asset.id}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                      <div className="w-12 h-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center font-black text-[#3a5ba1] dark:text-blue-400 shadow-sm group-hover:shadow-md transition-shadow uppercase text-xs">
                        {asset.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900 dark:text-white leading-none">{asset.symbol}</p>
                          <span className="text-[9px] bg-blue-50 dark:bg-blue-500/10 text-[#3a5ba1] dark:text-blue-400 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">
                            {asset.assetType}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium truncate max-w-[140px]">{asset.name}</p>
                        <p className="text-[9px] text-[#3a5ba1] dark:text-blue-400 font-black mt-0.5 uppercase tracking-tighter">{asset.sector}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex -space-x-2 overflow-hidden">
                      {asset.brokers.length > 0 ? asset.brokers.map((b, i) => (
                        <div key={i} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-900 text-[10px] font-black text-slate-600 dark:text-slate-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700" title={b}>
                          {b.charAt(0)}
                        </div>
                      )) : <span className="text-xs text-slate-300 dark:text-slate-700 italic">No brokers</span>}
                    </div>
                  </td>
                  <td className="px-6 py-5 font-bold text-slate-700 dark:text-slate-300 text-sm font-mono">
                    {asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-6 py-5 text-sm">
                    {asset.priceSource === 'MARKET' ? (
                      <div>
                        <p className="text-slate-900 dark:text-white font-bold">${asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <span className="text-[8px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded font-black tracking-widest uppercase">Mercado</span>
                      </div>
                    ) : asset.priceSource === 'COST' ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/30">
                          <Info size={10} /> Costo Promedio
                        </span>
                        <p className="text-[9px] text-slate-400 font-bold italic">(Sin precio de mercado)</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-900/30">
                          <AlertCircle size={10} /> Sin precio actualizado
                        </span>
                        <p className="text-[9px] text-slate-400 font-bold italic">(Faltan datos de valuación)</p>
                      </div>
                    )}
                    {asset.avgCost && asset.avgCost > 0 ? (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1.5 pt-1.5 border-t dark:border-slate-800">
                        Costo Base: <span className="font-bold text-slate-700 dark:text-slate-300">${asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </p>
                    ) : asset.priceSource !== 'NONE' ? (
                      <p className="text-[9px] text-amber-500 font-black italic uppercase mt-1.5 pt-1.5 border-t dark:border-slate-800">Costo no registrado</p>
                    ) : null}
                  </td>
                  <td className="px-6 py-5 font-black text-slate-900 dark:text-white text-sm">
                    <div className="flex flex-col">
                      <span>${asset.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      {asset.priceSource === 'COST' && (
                        <span className="text-[9px] text-amber-500 uppercase font-black tracking-tighter">(Basado en Costo)</span>
                      )}
                      {asset.priceSource === 'NONE' && (
                        <span className="text-[9px] text-rose-500 uppercase font-black tracking-tighter">(Sin valoración)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {asset.priceSource === 'MARKET' && asset.avgCost > 0 ? (
                      <div className={`flex flex-col ${asset.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        <div className="flex items-center gap-1 font-black text-sm">
                          {asset.pnl >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          ${Math.abs(asset.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] font-black opacity-80 pl-4">
                          {asset.pnlPercent >= 0 ? '+' : ''}{asset.pnlPercent.toFixed(2)}%
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-300 dark:text-slate-700 text-[10px] font-black uppercase">N/A</span>
                        <p className="text-[8px] text-slate-400 dark:text-slate-600 font-medium leading-tight">Faltan datos para P/L</p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link to={`/assets/${asset.id}`} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-300 dark:text-slate-600 hover:text-[#3a5ba1] dark:hover:text-blue-400 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700 inline-block shadow-sm group-hover:scale-105" aria-label={`Ver detalle de ${asset.symbol}`}>
                      <ChevronRight size={20} />
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-[1.5rem] flex items-center justify-center text-slate-300 dark:text-slate-700 border border-dashed border-slate-200 dark:border-slate-800">
                        <Briefcase size={32} />
                      </div>
                      <p className="text-slate-400 dark:text-slate-500 font-medium italic">No se encontraron activos que coincidan con la búsqueda.</p>
                      <button onClick={() => setSearchTerm('')} className="text-[#3a5ba1] dark:text-blue-400 font-bold text-sm hover:underline">Limpiar búsqueda</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Asset Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden border dark:border-slate-800">
            <div className="absolute top-0 right-0 p-8">
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddAsset} className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-[#3a5ba1] dark:text-blue-400 rounded-2xl flex items-center justify-center shadow-sm border border-blue-100 dark:border-blue-900/30">
                  <Sparkles size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Nuevo Activo</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium font-mono text-xs uppercase tracking-widest">Añadir a Cartera</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Ticker / Símbolo</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ej: AAPL, BTC"
                    value={newAsset.symbol}
                    onChange={(e) => handleSymbolChange(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#3a5ba1] focus:bg-white dark:focus:bg-slate-900 outline-none transition-all font-black text-slate-800 dark:text-white uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Tipo</label>
                  <select 
                    value={newAsset.type} 
                    onChange={e => setNewAsset(prev => ({ ...prev, type: e.target.value as AssetType }))}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#3a5ba1] outline-none transition-all font-bold text-slate-800 dark:text-white"
                  >
                    {Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Nombre del Activo</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Apple Inc."
                    value={newAsset.name}
                    onChange={e => setNewAsset(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#3a5ba1] outline-none transition-all font-bold text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Cantidad</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    required
                    placeholder="0.00"
                    value={newAsset.quantity}
                    onChange={e => setNewAsset(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#3a5ba1] outline-none transition-all font-black text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Precio Compra (Avg)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newAsset.avgCost}
                    onChange={e => setNewAsset(prev => ({ ...prev, avgCost: e.target.value }))}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#3a5ba1] outline-none transition-all font-black text-slate-800 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Plataforma (Broker)</label>
                  <select 
                    required
                    value={newAsset.brokerId} 
                    onChange={e => setNewAsset(prev => ({ ...prev, brokerId: e.target.value }))}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#3a5ba1] outline-none transition-all font-bold text-slate-800 dark:text-white"
                  >
                    <option value="">Seleccionar broker...</option>
                    {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-[#3a5ba1] hover:bg-[#2d4680] text-white rounded-[1.5rem] font-black shadow-xl shadow-[#3a5ba1]/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                  {isSubmitting ? 'Añadiendo...' : 'Confirmar e Invertir'}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-8 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-black rounded-[1.5rem] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
