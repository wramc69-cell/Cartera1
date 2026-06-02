
import React, { useMemo, useState } from 'react';
// Added AssetType to the import list from '../types'
import { DividendEvent, Broker, Asset, PortfolioEvent, User, Position, AssetType } from '../types';
import { 
  Calendar, CheckCircle2, Clock, Wallet, Plus, Trash2, 
  ChevronRight, Search, Filter, Calculator, Building2, AlertCircle, X,
  ArrowRight
} from 'lucide-react';
import { DividendService } from '../services/dividendService';

interface DividendsProps {
  dividends: DividendEvent[];
  setDividends: React.Dispatch<React.SetStateAction<DividendEvent[]>>;
  assets: Asset[];
  brokers: Broker[];
  positions: Position[];
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  setPortfolioEvents: React.Dispatch<React.SetStateAction<PortfolioEvent[]>>;
  user: User;
}

export const Dividends: React.FC<DividendsProps> = ({ 
  dividends, setDividends, assets, brokers, positions, setPositions, setAssets, setPortfolioEvents, user 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('');
  
  // Form State
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [useCalculator, setUseCalculator] = useState(true);
  const [amountPerShare, setAmountPerShare] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);

  const stats = useMemo(() => {
    const paid = dividends
      .filter(d => d.status === 'PAID')
      .reduce((acc, curr) => acc + curr.totalAmount, 0);
    const planned = dividends
      .filter(d => d.status === 'PLANNED')
      .reduce((acc, curr) => acc + curr.totalAmount, 0);
    
    return { paid, planned };
  }, [dividends]);

  const filteredDividends = useMemo(() => {
    return dividends
      .filter(d => d.symbol.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => new Date(b.payDate).getTime() - new Date(a.payDate).getTime());
  }, [dividends, filter]);

  const handleAddDividend = () => {
    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset || !selectedBrokerId) return;

    const finalAmount = useCalculator ? (asset.quantity * amountPerShare) : totalAmount;

    const newDiv: DividendEvent = {
      id: `div_${Date.now()}`,
      userId: user.id,
      assetId: asset.id,
      symbol: asset.symbol,
      payDate,
      totalAmount: finalAmount,
      amountPerShare: useCalculator ? amountPerShare : undefined,
      status: 'PLANNED',
      brokerId: selectedBrokerId
    };

    setDividends(prev => [newDiv, ...prev]);
    setIsModalOpen(false);
    resetForm();
  };

  const markAsPaid = (div: DividendEvent) => {
    if (div.status === 'PAID') return;
    
    const { updatedAssets, updatedPositions, newEvent } = DividendService.processPayment(
      div, assets, positions, user
    );

    setAssets(updatedAssets);
    setPositions(updatedPositions);
    setPortfolioEvents(prev => [newEvent, ...prev]);
    setDividends(prev => prev.map(d => d.id === div.id ? { ...d, status: 'PAID' } : d));
  };

  const deleteDividend = (id: string) => {
    if (confirm('¿Eliminar este registro de dividendo?')) {
      setDividends(prev => prev.filter(d => d.id !== id));
    }
  };

  const resetForm = () => {
    setSelectedAssetId('');
    setSelectedBrokerId('');
    setPayDate(new Date().toISOString().split('T')[0]);
    setAmountPerShare(0);
    setTotalAmount(0);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Ingresos Pasivos</h1>
          <p className="text-slate-500 mt-1 font-medium">Gestión de dividendos y cupones programados.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-[2rem] font-black flex items-center gap-3 transition-all shadow-xl shadow-indigo-100 active:scale-95"
        >
          <Plus size={20} />
          Registrar Dividendo
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex items-center gap-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <CheckCircle2 size={100} />
          </div>
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm border border-emerald-100 relative z-10">
            <CheckCircle2 size={32} />
          </div>
          <div className="relative z-10">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Cobrados Acumulado</p>
            <h2 className="text-3xl font-black text-slate-900 mt-1">${stats.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex items-center gap-6 relative overflow-hidden group">
           <div className="absolute right-0 top-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <Clock size={100} />
          </div>
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm border border-indigo-100 relative z-10">
            <Clock size={32} />
          </div>
          <div className="relative z-10">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Próximos Cobros</p>
            <h2 className="text-3xl font-black text-indigo-600 mt-1">${stats.planned.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl flex items-center gap-6 relative overflow-hidden group md:col-span-2 lg:col-span-1">
          <div className="absolute right-0 top-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <Calculator size={100} />
          </div>
          <div className="p-4 bg-white/10 rounded-2xl shadow-sm border border-white/10 relative z-10">
            <Wallet size={32} />
          </div>
          <div className="relative z-10">
            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">Yield Estimado Anual</p>
            <h2 className="text-3xl font-black mt-1">
              {assets.reduce((sum, a) => sum + (a.quantity * a.currentPrice), 0) > 0 
                ? ((stats.paid + stats.planned) / assets.reduce((sum, a) => sum + (a.quantity * a.currentPrice), 0) * 100).toFixed(2)
                : '0.00'}%
            </h2>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden">
        <div className="p-8 border-b bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="text-indigo-600" size={24} />
            <h3 className="font-black text-slate-800 text-lg uppercase tracking-wider">Historial y Calendario</h3>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar ticker..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold text-sm transition-all"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredDividends.length > 0 ? (
            filteredDividends.map((div) => (
              <div key={div.id} className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-slate-50/80 transition-all group">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white border-2 border-slate-100 rounded-[1.5rem] flex items-center justify-center font-black text-indigo-600 text-xl uppercase shadow-sm group-hover:shadow-md transition-all">
                    {div.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-black text-slate-900 text-2xl tracking-tight">{div.symbol}</h4>
                      <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest border ${
                        div.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {div.status === 'PAID' ? 'ABONADO' : 'PROGRAMADO'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs font-bold text-slate-400">
                       <span className="flex items-center gap-1.5"><Calendar size={14} /> {new Date(div.payDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                       <span className="flex items-center gap-1.5"><Building2 size={14} /> {brokers.find(b => b.id === div.brokerId)?.name}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-12">
                  <div className="text-left lg:text-right">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Monto Neto</p>
                    <p className={`text-3xl font-black ${div.status === 'PAID' ? 'text-slate-900' : 'text-indigo-600'}`}>${div.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    {div.amountPerShare && (
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                        ${div.amountPerShare.toFixed(3)} / acción
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {div.status === 'PLANNED' && (
                      <button 
                        onClick={() => markAsPaid(div)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                      >
                        <CheckCircle2 size={16} /> Cobrar
                      </button>
                    )}
                    <button 
                      onClick={() => deleteDividend(div.id)}
                      className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                    <div className="p-3 text-slate-200 group-hover:text-indigo-400 transition-colors">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-32 flex flex-col items-center justify-center text-center px-6">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-300 mb-6 border-2 border-dashed border-slate-200">
                <Calendar size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-400">No se encontraron cobros</h3>
              <p className="text-slate-400 text-sm mt-1 max-w-xs italic">
                Usa el botón superior para añadir tu primer dividendo manual o programado.
              </p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm border border-indigo-100">
                  <Plus size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Nuevo Dividendo</h3>
                  <p className="text-slate-500 font-medium">Programación manual de cobro</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Activo</label>
                    <select 
                      value={selectedAssetId} 
                      onChange={e => setSelectedAssetId(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all"
                    >
                      <option value="">Seleccionar...</option>
                      {assets.filter(a => a.assetType !== AssetType.CASH).map(a => <option key={a.id} value={a.id}>{a.symbol}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Broker de Cobro</label>
                    <select 
                      value={selectedBrokerId} 
                      onChange={e => setSelectedBrokerId(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all"
                    >
                      <option value="">Seleccionar...</option>
                      {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fecha de Pago</label>
                  <input 
                    type="date" 
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500"
                  />
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cálculo del Monto</label>
                    <button 
                      onClick={() => setUseCalculator(!useCalculator)}
                      className="text-indigo-600 font-bold text-[10px] uppercase hover:underline"
                    >
                      {useCalculator ? 'Ingresar Total Manual' : 'Usar Calculadora'}
                    </button>
                  </div>

                  {useCalculator ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Monto por Acción</p>
                          <input 
                            type="number" step="0.001" 
                            value={amountPerShare || ''} 
                            onChange={e => setAmountPerShare(parseFloat(e.target.value))}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-black text-slate-800 focus:border-indigo-500"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="pt-4 text-slate-300">X</div>
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Cantidad Poseída</p>
                          <div className="px-4 py-3 bg-white border border-slate-200 rounded-xl font-black text-slate-400">
                            {assets.find(a => a.id === selectedAssetId)?.quantity.toLocaleString() || '--'}
                          </div>
                        </div>
                      </div>
                      <div className="pt-2 flex justify-between items-center border-t border-slate-200">
                        <p className="text-xs font-bold text-slate-500">Total Estimado:</p>
                        <p className="text-lg font-black text-slate-900">
                          ${((assets.find(a => a.id === selectedAssetId)?.quantity || 0) * amountPerShare).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Neto a Recibir</p>
                       <input 
                        type="number" step="0.01" 
                        value={totalAmount || ''} 
                        onChange={e => setTotalAmount(parseFloat(e.target.value))}
                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-black text-slate-800 focus:border-indigo-500 text-center text-xl"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={handleAddDividend}
                    disabled={!selectedAssetId || !selectedBrokerId || (useCalculator ? amountPerShare <= 0 : totalAmount <= 0)}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50"
                  >
                    Guardar y Programar
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-[1.5rem] transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
