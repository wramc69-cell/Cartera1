
import React, { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, TrendingUp, TrendingDown, Clock, Plus, Minus, AlertCircle, 
  Calendar, Info, ChevronRight, Filter, Building2, Trash2, Save, Thermometer,
  Zap
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Asset, Position, Broker, PortfolioEvent, PortfolioEventType, User, AssetFundamentals, AssetType, PriceSnapshot, BrokerBalance } from '../types';
import { calculateWeightedAverage } from '../utils/portfolioUtils';
import { RiskEngine } from '../services/riskEngine';

interface AssetDetailProps {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  positions: Position[];
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  brokers: Broker[];
  balances: BrokerBalance[];
  snapshots: PriceSnapshot[];
  portfolioEvents: PortfolioEvent[];
  setPortfolioEvents: React.Dispatch<React.SetStateAction<PortfolioEvent[]>>;
  fundamentals: AssetFundamentals[];
  setFundamentals: React.Dispatch<React.SetStateAction<AssetFundamentals[]>>;
  user: User;
}

export const AssetDetail: React.FC<AssetDetailProps> = ({
  assets, setAssets, positions, setPositions, brokers, balances, snapshots, portfolioEvents, setPortfolioEvents, fundamentals, setFundamentals, user
}) => {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<string>('ALL');
  
  // Modal state for manual adjustment
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjType, setAdjType] = useState<PortfolioEventType>(PortfolioEventType.BUY);
  const [adjBroker, setAdjBroker] = useState('');
  const [adjQuantity, setAdjQuantity] = useState<number>(0);
  const [adjPrice, setAdjPrice] = useState<number>(0);
  const [adjNote, setAdjNote] = useState('');

  // Fundamentals state
  const [isEditingFund, setIsEditingFund] = useState(false);
  const [tempPeg, setTempPeg] = useState<string>('');

  const asset = useMemo(() => assets.find(a => a.id === assetId), [assets, assetId]);
  const assetFund = useMemo(() => fundamentals.find(f => f.assetId === assetId), [fundamentals, assetId]);

  const totalPortfolioValue = useMemo(() => 
    assets.reduce((sum, a) => sum + (a.quantity * a.currentPrice), 0), 
  [assets]);

  const riskResult = useMemo(() => {
    if (!asset) return null;
    return RiskEngine.calculateAssetRisk(asset, totalPortfolioValue, assetFund, snapshots);
  }, [asset, totalPortfolioValue, assetFund, snapshots]);

  const assetSnapshots = useMemo(() => 
    snapshots
      .filter(s => s.assetId === assetId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [snapshots, assetId]
  );

  const assetEvents = useMemo(() => 
    portfolioEvents
      .filter(e => e.assetId === assetId)
      .filter(e => filterType === 'ALL' || e.type === filterType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [portfolioEvents, assetId, filterType]
  );

  const assetPositions = useMemo(() => 
    positions.filter(p => p.assetId === assetId),
    [positions, assetId]
  );

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <AlertCircle size={48} className="mb-4 text-slate-300" />
        <h2 className="text-xl font-bold">Activo no encontrado</h2>
        <Link to="/assets" className="mt-4 text-indigo-600 font-bold hover:underline">Volver a Cartera</Link>
      </div>
    );
  }

  const handleManualAdjustment = () => {
    if (!adjBroker || adjQuantity <= 0 || adjPrice <= 0) return;
    const broker = brokers.find(b => b.id === adjBroker);
    if (!broker) return;
    const date = new Date().toISOString();
    
    const transactionTotal = adjQuantity * adjPrice;

    // 1. Create Transaction Event for Asset
    const newEvent: PortfolioEvent = {
      id: `event_${Date.now()}`,
      userId: user.id,
      assetId: asset.id,
      brokerId: broker.id,
      date,
      type: adjType,
      quantityDelta: adjType === PortfolioEventType.SELL ? -adjQuantity : adjQuantity,
      priceUsed: adjPrice,
      note: adjNote
    };
    
    // 2. Local copies for state updates
    let updatedPositions = [...positions];
    let updatedAssets = [...assets];
    let updatedEvents = [...portfolioEvents, newEvent];

    // 3. Update Asset Position
    const currentPosIndex = updatedPositions.findIndex(p => p.assetId === assetId && p.brokerId === broker.id);
    if (adjType === PortfolioEventType.BUY) {
      if (currentPosIndex !== -1) {
        const p = updatedPositions[currentPosIndex];
        const newAvg = calculateWeightedAverage(p.quantity, p.avgCost, adjQuantity, adjPrice);
        updatedPositions[currentPosIndex] = { ...p, quantity: p.quantity + adjQuantity, avgCost: newAvg, updatedAt: date };
      } else {
        updatedPositions.push({ id: `pos_${Date.now()}`, userId: user.id, assetId: asset.id, brokerId: broker.id, quantity: adjQuantity, avgCost: adjPrice, createdAt: date, updatedAt: date });
      }
    } else if (adjType === PortfolioEventType.SELL) {
      if (currentPosIndex !== -1) {
        const p = updatedPositions[currentPosIndex];
        const newQty = Math.max(0, p.quantity - adjQuantity);
        updatedPositions[currentPosIndex] = { ...p, quantity: newQty, updatedAt: date };
      }
    }

    // 4. SYNC CASH (Liquidez)
    let cashAsset = updatedAssets.find(a => a.assetType === AssetType.CASH);
    
    // Create CASH asset if not exists
    if (!cashAsset) {
      cashAsset = {
        id: `asset_cash_${Date.now()}`,
        userId: user.id,
        symbol: 'CASH',
        name: 'Liquidez Portfolio',
        assetType: AssetType.CASH,
        currency: 'USD',
        isDividendAsset: false,
        quantity: 0,
        avgCost: 1,
        currentPrice: 1
      };
      updatedAssets.push(cashAsset);
    }

    const cashDelta = adjType === PortfolioEventType.BUY ? -transactionTotal : transactionTotal;
    
    // Update/Create Cash Position for this Broker
    const cashPosIndex = updatedPositions.findIndex(p => p.assetId === cashAsset!.id && p.brokerId === broker.id);
    if (cashPosIndex !== -1) {
      const cp = updatedPositions[cashPosIndex];
      updatedPositions[cashPosIndex] = { ...cp, quantity: cp.quantity + cashDelta, updatedAt: date };
    } else {
      updatedPositions.push({
        id: `pos_cash_${Date.now()}`,
        userId: user.id,
        assetId: cashAsset!.id,
        brokerId: broker.id,
        quantity: cashDelta,
        avgCost: 1,
        createdAt: date,
        updatedAt: date
      });
    }

    // Create Cash Adjustment Event for traceability
    updatedEvents.push({
      id: `event_cash_adj_${Date.now()}`,
      userId: user.id,
      assetId: cashAsset!.id,
      brokerId: broker.id,
      date,
      type: PortfolioEventType.ADJUST,
      quantityDelta: cashDelta,
      priceUsed: 1,
      note: `Ajuste automático por ${adjType === PortfolioEventType.BUY ? 'compra' : 'venta'} de ${asset.symbol}`
    });

    // 5. Sync Asset Totals (Quantity & Price)
    // Update original asset
    const assetPositionsAfter = updatedPositions.filter(p => p.assetId === assetId);
    const totalQty = assetPositionsAfter.reduce((sum, p) => sum + p.quantity, 0);
    const totalCost = assetPositionsAfter.reduce((sum, p) => sum + (p.quantity * p.avgCost), 0);
    
    const assetIdx = updatedAssets.findIndex(a => a.id === assetId);
    if (assetIdx !== -1) {
      updatedAssets[assetIdx] = { 
        ...updatedAssets[assetIdx], 
        quantity: totalQty, 
        avgCost: totalQty > 0 ? totalCost / totalQty : updatedAssets[assetIdx].avgCost 
      };
    }

    // Update cash asset total
    const cashAssetIdx = updatedAssets.findIndex(a => a.assetType === AssetType.CASH);
    const cashPositionsAfter = updatedPositions.filter(p => p.assetId === cashAsset!.id);
    const totalCashQty = cashPositionsAfter.reduce((sum, p) => sum + p.quantity, 0);
    
    updatedAssets[cashAssetIdx] = {
      ...updatedAssets[cashAssetIdx],
      quantity: totalCashQty
    };

    // 6. Commit State
    setPortfolioEvents(updatedEvents);
    setPositions(updatedPositions);
    setAssets(updatedAssets);
    
    setIsAdjModalOpen(false);
    resetAdjForm();
  };

  const handleSaveFundamentals = () => {
    const pegNum = tempPeg === '' ? null : parseFloat(tempPeg);
    const newFund: AssetFundamentals = { assetId: asset.id, peg: pegNum, updatedAt: new Date().toISOString() };
    setFundamentals(prev => {
      const idx = prev.findIndex(f => f.assetId === asset.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = newFund;
        return next;
      }
      return [...prev, newFund];
    });
    setIsEditingFund(false);
  };

  const resetAdjForm = () => {
    setAdjBroker('');
    setAdjQuantity(0);
    setAdjPrice(asset.currentPrice);
    setAdjNote('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/assets')} className="p-3 hover:bg-white rounded-2xl border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-indigo-600">
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">{asset.symbol}</h1>
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-black tracking-widest uppercase">{asset.assetType}</span>
            </div>
            <p className="text-slate-500 font-medium text-lg">{asset.name}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button onClick={() => { setAdjType(PortfolioEventType.BUY); setAdjPrice(asset.currentPrice); setIsAdjModalOpen(true); }} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
            <Plus size={18} /> Compra
          </button>
          <button onClick={() => { setAdjType(PortfolioEventType.SELL); setAdjPrice(asset.currentPrice); setIsAdjModalOpen(true); }} className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-rose-700 transition-all shadow-lg shadow-rose-100">
            <Minus size={18} /> Venta
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Precio Actual</p>
          <h2 className="text-3xl font-black text-slate-900">${asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          <p className="text-[10px] text-slate-400 mt-1 font-bold">USD</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Costo Promedio</p>
          <h2 className="text-3xl font-black text-slate-900">${asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          <p className="text-[10px] text-slate-400 mt-1 font-bold">Valor Libros: ${(asset.quantity * asset.avgCost).toLocaleString()}</p>
        </div>
        {riskResult && (
          <div className={`p-6 rounded-[2rem] border shadow-sm col-span-1 md:col-span-2 flex items-center gap-8 ${
            riskResult.level === 'Alto' ? 'bg-rose-50 border-rose-100' : 
            riskResult.level === 'Medio' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
          }`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm bg-white ${
              riskResult.level === 'Alto' ? 'text-rose-600' : riskResult.level === 'Medio' ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              <Thermometer size={32} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Análisis de Riesgo</p>
                <span className="text-[10px] font-black text-slate-400 bg-white/50 px-2 py-0.5 rounded-full">{riskResult.score}/100</span>
              </div>
              <h3 className={`text-2xl font-black uppercase tracking-tight mb-1 ${
                riskResult.level === 'Alto' ? 'text-rose-600' : riskResult.level === 'Medio' ? 'text-amber-600' : 'text-emerald-600'
              }`}>{riskResult.level}</h3>
              <p className="text-[10px] font-bold text-slate-500 flex flex-wrap gap-x-2">
                {riskResult.drivers.map((d, i) => <span key={i} className="flex items-center gap-1"><Zap size={10} /> {d}</span>)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <h3 className="font-black text-slate-800 text-lg uppercase tracking-wider mb-8 flex items-center gap-2">
              <TrendingUp className="text-indigo-600" size={20} /> Historial de Precios
            </h3>
            <div className="min-h-[350px]">
              {assetSnapshots.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={assetSnapshots}>
                    <defs><linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(d) => new Date(d).toLocaleDateString()} />
                    <YAxis hide domain={['dataMin * 0.95', 'dataMax * 1.05']} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px' }} labelFormatter={(l) => new Date(l).toLocaleDateString()} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Precio']} />
                    <Area type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex flex-col items-center justify-center text-slate-300 gap-3 border-2 border-dashed border-slate-50 rounded-[2rem]"><Clock size={40} /><p className="text-sm font-medium italic">Sin datos históricos de precios aún.</p></div>
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-wider flex items-center gap-2"><Clock className="text-indigo-600" size={20} /> Timeline de Movimientos</h3>
              <div className="flex items-center gap-2 bg-slate-50 border rounded-2xl px-3 py-1.5">
                <Filter size={14} className="text-slate-400" />
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-xs font-bold text-slate-600 bg-transparent outline-none cursor-pointer">
                  <option value="ALL">Todos</option>
                  {Object.values(PortfolioEventType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="relative space-y-6 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
              {assetEvents.map((event) => (
                <div key={event.id} className="relative pl-12 group">
                  <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 
                    ${event.type === PortfolioEventType.BUY ? 'bg-emerald-50 text-emerald-600' : 
                      event.type === PortfolioEventType.SELL ? 'bg-rose-50 text-rose-600' : 
                      event.type === PortfolioEventType.IMPORT ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                    {event.type === PortfolioEventType.BUY ? <Plus size={16} /> : event.type === PortfolioEventType.SELL ? <Minus size={16} /> : event.type === PortfolioEventType.IMPORT ? <Save size={16} /> : <Clock size={16} />}
                  </div>
                  <div className="bg-slate-50/50 group-hover:bg-slate-50 p-5 rounded-2xl border border-transparent group-hover:border-slate-100 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-900 tracking-tight uppercase text-sm">
                          {event.type === PortfolioEventType.BUY ? 'Compra' : event.type === PortfolioEventType.SELL ? 'Venta' : event.type === PortfolioEventType.IMPORT ? 'Importación' : 'Ajuste'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(event.date).toLocaleDateString()}</span>
                      </div>
                      <p className={`font-black text-sm ${event.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{event.quantityDelta > 0 ? '+' : ''}{event.quantityDelta.toLocaleString()} <span className="text-[10px]">UND</span></p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                      <div className="flex items-center gap-1 text-slate-500 font-medium"><Building2 size={12} className="text-slate-300" /> {brokers.find(b => b.id === event.brokerId)?.name || 'Desconocido'}</div>
                      <div className="flex items-center gap-1 text-slate-500 font-medium"><Info size={12} className="text-slate-300" /> Precio: <span className="text-slate-900 font-bold">${event.priceUsed.toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-3"><Info className="text-indigo-600" /> Fundamentales</h3>
            <div className="space-y-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group relative">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PEG Ratio</p>
                  {!isEditingFund ? (
                    <button onClick={() => { setIsEditingFund(true); setTempPeg(assetFund?.peg?.toString() || ''); }} className="text-indigo-600 hover:underline text-[10px] font-bold">Editar</button>
                  ) : (
                    <div className="flex gap-2">
                       <button onClick={handleSaveFundamentals} className="text-emerald-600 text-[10px] font-bold">Guardar</button>
                       <button onClick={() => setIsEditingFund(false)} className="text-slate-400 text-[10px] font-bold">X</button>
                    </div>
                  )}
                </div>
                {!isEditingFund ? (
                  <p className="text-2xl font-black text-slate-900">{assetFund?.peg !== null && assetFund?.peg !== undefined ? assetFund.peg : '--'}</p>
                ) : (
                  <input type="number" step="0.01" value={tempPeg} onChange={e => setTempPeg(e.target.value)} className="w-full bg-white border rounded-lg px-2 py-1 text-lg font-black focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus />
                )}
                <p className="text-[9px] text-slate-400 mt-2">PEG &gt; 2.0 indica sobrevaloración (mayor riesgo).</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-3"><Building2 className="text-indigo-400" /> Tus Brokers</h3>
            <div className="space-y-4">
              {assetPositions.map(pos => (
                <div key={pos.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex justify-between items-start mb-2"><p className="font-black text-indigo-400 uppercase text-xs tracking-widest">{brokers.find(br => br.id === pos.brokerId)?.name}</p></div>
                  <div className="flex justify-between items-end">
                    <div><p className="text-2xl font-black">{pos.quantity.toLocaleString()}</p><p className="text-[9px] font-bold text-slate-500 uppercase">Posición</p></div>
                    <div className="text-right"><p className="text-sm font-bold">${(pos.quantity * asset.currentPrice).toLocaleString()}</p><p className="text-[9px] font-bold text-slate-500 uppercase">Valor Mercado</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isAdjModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative">
            <div className="absolute top-0 right-0 p-8"><button onClick={() => setIsAdjModalOpen(false)} className="text-slate-300 hover:text-slate-900 transition-colors"><Trash2 size={24} /></button></div>
            <div className="space-y-8">
              <div className="flex items-center gap-4"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border ${adjType === PortfolioEventType.BUY ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{adjType === PortfolioEventType.BUY ? <Plus size={28} /> : <Minus size={28} />}</div><div><h3 className="text-2xl font-black text-slate-900 tracking-tight">{adjType === PortfolioEventType.BUY ? 'Registrar Compra' : 'Registrar Venta'}</h3><p className="text-slate-500 font-medium">Actualizando {asset.symbol}</p></div></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Broker</label><select value={adjBroker} onChange={e => setAdjBroker(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-800"><option value="">Seleccionar...</option>{brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cantidad</label><input type="number" step="0.0001" value={adjQuantity || ''} onChange={e => setAdjQuantity(parseFloat(e.target.value))} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-800" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Precio</label><input type="number" step="0.01" value={adjPrice || ''} onChange={e => setAdjPrice(parseFloat(e.target.value))} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-800" /></div>
                <div className="space-y-2 sm:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nota</label><input type="text" value={adjNote} onChange={e => setAdjNote(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-800" /></div>
              </div>
              <div className="pt-4 flex gap-3"><button onClick={handleManualAdjustment} disabled={!adjBroker || adjQuantity <= 0 || adjPrice <= 0} className={`flex-1 py-4 rounded-2xl font-black text-white shadow-xl active:scale-95 disabled:opacity-50 ${adjType === PortfolioEventType.BUY ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>Confirmar Transacción</button><button onClick={() => setIsAdjModalOpen(false)} className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all">Cancelar</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
