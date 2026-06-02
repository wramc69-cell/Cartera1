
import React, { useMemo, useState } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Wallet, DollarSign, PieChart as PieChartIcon, 
  RefreshCw, BarChart3, Shield, ChevronRight, X, Building2, Coins, Sparkles, Clock, CheckCircle, Check,
  Eye, EyeOff, ChevronUp, Info, AlertCircle, Plus
} from 'lucide-react';
import { Asset, Position, Broker, PriceSnapshot, AssetFundamentals, AlertRule, User, NotificationLog, DividendEvent, PortfolioEvent, BrokerBalance, AssetType } from '../types';
import { Link } from 'react-router-dom';
import { PortfolioService } from '../services/portfolioService';
import { PriceService } from '../services/priceService';
import { SupabaseService } from '../services/supabaseService';
import { RiskEngine } from '../services/riskEngine';
import { AlertEngine } from '../services/alertService';

interface DashboardProps {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  positions: Position[];
  brokers: Broker[];
  balances: BrokerBalance[];
  snapshots: PriceSnapshot[];
  setSnapshots: React.Dispatch<React.SetStateAction<PriceSnapshot[]>>;
  fundamentals: AssetFundamentals[];
  user: User;
  alerts: AlertRule[];
  setNotificationLogs: React.Dispatch<React.SetStateAction<NotificationLog[]>>;
  dividends: DividendEvent[];
  portfolioEvents: PortfolioEvent[];
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  assets, setAssets, positions, brokers, balances, snapshots, setSnapshots, fundamentals, user, alerts, setNotificationLogs, dividends
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [timeRange, setTimeRange] = useState('6M');
  const [showValues, setShowValues] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  const summary = useMemo(() => 
    PortfolioService.getSummary(assets, positions, brokers, balances, snapshots),
  [assets, positions, brokers, balances, snapshots]);

  const upcomingDividends = useMemo(() => {
    const today = new Date();
    const next30Days = new Date(today);
    next30Days.setDate(today.getDate() + 30);

    return dividends
      .filter(d => {
        const payDate = new Date(d.payDate);
        return d.status === 'PLANNED' && payDate.getTime() >= today.getTime() && payDate.getTime() <= next30Days.getTime();
      })
      .sort((a, b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
  }, [dividends]);

  const estimatedDividendTotal = useMemo(() => 
    upcomingDividends.reduce((sum, d) => sum + d.totalAmount, 0),
  [upcomingDividends]);

  const portfolioRisk = useMemo(() => {
    const assetRisks = assets.map(a => {
      const fund = fundamentals.find(f => f.assetId === a.id);
      return RiskEngine.calculateAssetRisk(a, summary.totalNetWorth, fund, snapshots);
    });
    return RiskEngine.calculatePortfolioRisk(assetRisks, summary.totalNetWorth, assets);
  }, [assets, summary.totalNetWorth, fundamentals, snapshots]);

  // Chart data simulation (in a real app this would come from a historical table)
  const chartData = useMemo(() => {
    const data = [];
    const now = new Date();
    const points = timeRange === '1D' ? 24 : 30;
    const baseValue = summary.totalNetWorth > 0 ? summary.totalNetWorth * 0.95 : 10000;

    for (let i = 0; i <= points; i++) {
      const date = new Date(now);
      if (timeRange === '1D') date.setHours(now.getHours() - (points - i));
      else date.setDate(now.getDate() - (points - i));
      
      const random = Math.sin((points - i) * 0.5) * 0.02 + 1;
      data.push({
        date: timeRange === '1D' ? `${date.getHours()}:00` : date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        value: i === points ? (summary.totalNetWorth || baseValue) : baseValue * random,
      });
    }
    return data;
  }, [summary.totalNetWorth, timeRange]);

  const [retryTimer, setRetryTimer] = useState<number | null>(null);

  const [syncSummary, setSyncSummary] = useState<{
    totalToProcess: number;
    totalUpdated: number;
    totalFailed: number;
    totalSkipped: number;
    totalRateLimited: number;
    totalAlreadyFresh: number;
    skippedList: string[];
    failedList: string[];
    updatedList: string[];
    rateLimitedList: string[];
    alreadyFreshList: string[];
    errors: string[];
    isComplete: boolean;
  } | null>(null);

  const updatePrices = async (isRetry = false) => {
    setIsUpdating(true);
    
    if (!isRetry) {
      setSyncSummary(null);
      setRetryTimer(null);
    }
    
    try {
      const userAssetIds = new Set(positions.map(p => p.assetId));
      let myPortfolioAssets = assets.filter(a => userAssetIds.has(a.id));

      if (isRetry && syncSummary) {
        console.log(`[MARKET] AUTO_RETRY_START pending=${syncSummary.rateLimitedList.length}`);
        const rateLimitedSet = new Set(syncSummary.rateLimitedList);
        myPortfolioAssets = myPortfolioAssets.filter(a => rateLimitedSet.has(a.symbol.toUpperCase()));
      }

      if (myPortfolioAssets.length === 0) {
        if (!isRetry) alert("No tienes posiciones abiertas para actualizar precios de mercado.");
        setIsUpdating(false);
        return;
      }

      const result = await PriceService.updateAllPrices(myPortfolioAssets, user.id);
      
      setAssets(result.updatedAssets);

      const freshSnapshots = await SupabaseService.priceSnapshots.listRecent(800, user.id);
      if (freshSnapshots && freshSnapshots.length > 0) {
        setSnapshots(freshSnapshots);
      }

      setSyncSummary(prev => {
        if (!prev || !isRetry) return { ...result.stats, errors: result.errors, isComplete: result.isComplete };
        
        // Merge stats on retry
        const totalUpdatedSet = new Set([...prev.updatedList, ...result.stats.updatedList]);
        const rateLimitedSet = new Set(result.stats.rateLimitedList);
        // Symbols in failedList might already be there, consolidate them
        const failedMap = new Map();
        [...prev.failedList, ...result.stats.failedList].forEach(f => {
          const sym = f.split(' ')[0];
          failedMap.set(sym, f);
        });

        return {
          ...prev,
          totalUpdated: totalUpdatedSet.size,
          totalRateLimited: rateLimitedSet.size,
          totalFailed: failedMap.size,
          updatedList: Array.from(totalUpdatedSet),
          rateLimitedList: Array.from(rateLimitedSet),
          failedList: Array.from(failedMap.values()),
          isComplete: result.isComplete,
          errors: Array.from(new Set([...prev.errors, ...result.errors]))
        };
      });

      if (!result.isComplete) {
        const WAIT_SECONDS = 65;
        console.log(`[MARKET] AUTO_RETRY_WAIT seconds=${WAIT_SECONDS}`);
        setRetryTimer(WAIT_SECONDS);
        
        const countdownInterval = setInterval(() => {
          setRetryTimer(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownInterval);
              if (prev !== null) updatePrices(true);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setRetryTimer(null);
        console.log(`[MARKET] RUN_FINISHED_COMPLETE`);
      }
      
    } catch (err: any) {
      console.error("Error updating prices:", err);
      if (!isRetry) alert(`Fallo en la comunicación: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const pieData = Object.entries(summary.allocationByType).map(([name, value]) => ({ name, value: value as number }));
  const sectorData = Object.entries(summary.allocationBySector)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Dashboard Estratégico</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Control en tiempo real de tu patrimonio y activos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={updatePrices}
            disabled={isUpdating}
            className="bg-white dark:bg-slate-900 border dark:border-slate-800 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-sm transition-all active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <RefreshCw size={16} className={isUpdating || retryTimer ? 'animate-spin' : ''} />
            {isUpdating ? 'Actualizando...' : retryTimer ? `Esperando Cuota (${retryTimer}s)` : 'Actualizar Mercado'}
          </button>
          <Link to="/ai" className="bg-[#3a5ba1] hover:bg-[#2d4680] text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-blue-100 transition-all active:scale-95 text-xs uppercase tracking-widest">
            <Sparkles size={16} /> Asesoría IA
          </Link>
        </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900/50 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 p-8 opacity-5 text-slate-900 dark:text-white">
            <DollarSign size={100} />
          </div>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Patrimonio Total</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">
              {showValues ? `$${summary.totalNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '••••••'}
            </h2>
            {summary.totalNetWorth === 0 && summary.hasPositions && (
              <span className="text-[9px] bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded font-black tracking-tight flex items-center gap-1 animate-pulse">
                <AlertCircle size={10} /> Valoración Pendiente
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            {summary.unpricedAssetsCount && summary.unpricedAssetsCount > 0 ? (
               <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black tracking-widest bg-amber-50 text-amber-600 border border-amber-100">
                <RefreshCw size={10} className="animate-spin" /> {summary.unpricedAssetsCount} ACTIVOS SIN PRECIO
              </div>
            ) : (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black tracking-widest ${summary.totalProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <TrendingUp size={12} />
                {summary.totalProfitPercent >= 0 ? '+' : ''}{summary.totalProfitPercent.toFixed(2)}% TOTAL
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={() => setShowCashModal(true)}
          className="bg-white dark:bg-slate-900/50 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm text-left relative overflow-hidden group transition-all hover:border-[#3a5ba1] active:scale-[0.98]"
        >
          <div className="absolute -right-4 -top-4 p-8 opacity-5">
            <Wallet size={100} />
          </div>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Liquidez Disponible</p>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white">
            {showValues ? `$${summary.totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '••••••'}
          </h2>
          <div className="mt-4 text-[9px] font-black text-[#3a5ba1] uppercase tracking-widest flex items-center gap-1">
            Ver detalle por Broker <ChevronRight size={10} />
          </div>
        </button>

        <div className="bg-white dark:bg-slate-900/50 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 p-8 opacity-5 text-[#3a5ba1]">
            <Shield size={100} />
          </div>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Salud de Cartera</p>
          <h2 className={`text-3xl font-black ${portfolioRisk.level === 'Alto' ? 'text-rose-600' : portfolioRisk.level === 'Medio' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {portfolioRisk.level}
          </h2>
          <p className="mt-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Risk Score: {portfolioRisk.score}</p>
        </div>

        <Link to="/alerts" className="bg-slate-900 dark:bg-slate-800 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group transition-all hover:translate-y-[-2px]">
          <div className="absolute -right-4 -top-4 p-8 opacity-10">
            <Coins size={100} />
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Alertas y Eventos</p>
          <h2 className="text-2xl font-black uppercase tracking-tight">Gestión Activa</h2>
          <p className="mt-4 text-[9px] font-black text-blue-400 tracking-widest uppercase flex items-center gap-1">Monitorear cuenta <ChevronRight size={10} /></p>
        </Link>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/50 rounded-[3rem] border dark:border-slate-800 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-3">
              <TrendingUp className="text-[#3a5ba1]" /> Rendimiento Histórico
            </h3>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {['1D', '1M', '6M', '1Y'].map(r => (
                <button key={r} onClick={() => setTimeRange(r)} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${timeRange === r ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>{r}</button>
              ))}
            </div>
          </div>
          <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
               </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 rounded-[3rem] border dark:border-slate-800 shadow-sm p-8">
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider mb-8 flex items-center gap-3">
            <BarChart3 className="text-[#3a5ba1]" /> Diversificación Por Sector
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} width={80} />
                <Bar dataKey="value" fill="#3a5ba1" radius={[0, 10, 10, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Asset Mix Section */}
      <div className="bg-white dark:bg-slate-900/50 p-12 rounded-[3.5rem] border dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-center gap-16">
        <div className="lg:w-1/3 space-y-6">
          <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Distribución</h3>
          <p className="text-slate-500 font-medium leading-relaxed">Visualiza tu exposición real por clase de activo. El equilibrio entre renta variable, cripto y liquidez es la base de una estrategia ganadora.</p>
          <div className="space-y-4 pt-4">
             {pieData.map((entry, index) => (
               <div key={index} className="flex justify-between items-center text-sm font-bold border-b dark:border-slate-800 pb-3 last:border-0">
                 <span className="flex items-center gap-2 uppercase text-[11px] tracking-widest text-slate-500">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    {entry.name}
                 </span>
                 <span className="text-slate-900 dark:text-white">${entry.value.toLocaleString()}</span>
               </div>
             ))}
          </div>
        </div>
        <div className="lg:w-2/3 h-[400px] w-full">
           <ResponsiveContainer width="100%" height="100%">
             <PieChart>
               <Pie data={pieData} innerRadius={100} outerRadius={140} paddingAngle={8} dataKey="value" stroke="none">
                 {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
               </Pie>
               <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', padding: '16px' }} />
             </PieChart>
           </ResponsiveContainer>
        </div>
      </div>

      {/* Price Sync Summary Modal */}
      {syncSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl relative border dark:border-slate-800 animate-in fade-in zoom-in duration-300">
            {syncSummary.isComplete && !retryTimer && (
              <button onClick={() => setSyncSummary(null)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            )}
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3 uppercase tracking-tight">
              {retryTimer ? <Clock className="text-amber-500 animate-pulse" /> : <Sparkles className="text-indigo-600" />} 
              {retryTimer ? 'Completando Cartera...' : 'Resumen de Actualización'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8">
              {retryTimer 
                ? `Esperando reinicio de cuota del proveedor para procesar pendientes... (${retryTimer}s)` 
                : 'Estado de la sincronización con el mercado.'}
              {!syncSummary.isComplete && !retryTimer && (
                <span className="block mt-1 text-[10px] text-amber-600 font-bold uppercase tracking-tight">
                  * Proceso incompleto por límites del proveedor. El sistema reintentará automáticamente.
                </span>
              )}
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-8">
              <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 text-center">
                <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Mercado</p>
                <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{syncSummary.totalToProcess}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 text-center">
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Éxitos</p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{syncSummary.totalUpdated}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-500/10 p-3 rounded-2xl border border-blue-100 dark:border-blue-500/20 text-center">
                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Recientes</p>
                <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{syncSummary.totalAlreadyFresh}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-2xl border border-amber-100 dark:border-amber-500/20 text-center">
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Cuota</p>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{syncSummary.totalRateLimited}</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-500/10 p-3 rounded-2xl border border-rose-100 dark:border-rose-500/20 text-center">
                <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">Fallos</p>
                <p className="text-2xl font-black text-rose-700 dark:text-rose-300">{syncSummary.totalFailed}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-500/10 p-3 rounded-2xl border border-slate-100 dark:border-slate-500/20 text-center">
                <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1">Omitidos</p>
                <p className="text-2xl font-black text-slate-700 dark:text-slate-300">{syncSummary.totalSkipped}</p>
              </div>
            </div>

            <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {syncSummary.alreadyFreshList.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
                    <CheckCircle size={12} strokeWidth={3} /> Ya estaban actualizados ({syncSummary.alreadyFreshList.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {syncSummary.alreadyFreshList.map((s, idx) => (
                      <span key={`${s}-${idx}`} className="px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg text-[10px] font-bold border border-blue-100 dark:border-blue-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="text-[9px] text-blue-600/70 mt-2 font-medium italic">* Estos activos fueron omitidos porque se actualizaron en los últimos 30 minutos.</p>
                </div>
              )}

              {syncSummary.rateLimitedList.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2 font-mono">
                    <Clock size={12} strokeWidth={3} /> Pendientes por Límite de Cuota ({syncSummary.rateLimitedList.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {syncSummary.rateLimitedList.map((s, idx) => (
                      <span key={`${s}-${idx}`} className="px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg text-[10px] font-bold border border-amber-100 dark:border-amber-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="text-[9px] text-amber-600/70 mt-2 font-medium italic">* Estos activos no pudieron ser actualizados porque el proveedor alcanzó su límite de peticiones simultáneas. Intenta de nuevo en unos minutos.</p>
                </div>
              )}

              {syncSummary.failedList.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <X size={12} strokeWidth={3} /> Símbolos Fallidos ({syncSummary.failedList.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {syncSummary.failedList.map((s, idx) => (
                      <span key={`${s}-${idx}`} className="px-3 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 rounded-lg text-[10px] font-bold border border-rose-100 dark:border-rose-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {syncSummary.skippedList.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <EyeOff size={12} strokeWidth={3} /> Símbolos Omitidos ({syncSummary.skippedList.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {syncSummary.skippedList.map((s, idx) => (
                      <span key={`${s}-${idx}`} className="px-3 py-1 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2 italic">* Se omiten automáticamente activos de tipo CASH, EFECTIVO e instrumentos de renta fija interna.</p>
                </div>
              )}
              
              {syncSummary.errors.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 p-4 rounded-2xl">
                   <h4 className="text-[11px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertCircle size={12} strokeWidth={3} /> Notas del Sistema
                  </h4>
                  <ul className="text-[10px] text-amber-800 dark:text-amber-400/80 space-y-1 list-disc pl-4 font-medium">
                    {syncSummary.errors.slice(0, 5).map((e, idx) => <li key={idx}>{e}</li>)}
                    {syncSummary.errors.length > 5 && <li>...y {syncSummary.errors.length - 5} errores más.</li>}
                  </ul>
                </div>
              )}
            </div>

            {!retryTimer ? (
              <button 
                onClick={() => setSyncSummary(null)} 
                className="w-full mt-10 py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black rounded-3xl transition-transform active:scale-95 shadow-xl shadow-slate-200 dark:shadow-none uppercase tracking-widest text-xs"
              >
                {syncSummary.isComplete ? 'Cerrar Resumen' : 'Cerrar y esperar en segundo plano'}
              </button>
            ) : (
              <div className="w-full mt-10 p-5 bg-amber-50 dark:bg-amber-500/10 border border-dashed border-amber-300 dark:border-amber-500/30 rounded-3xl text-center">
                <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin" /> Reintento Automático en {retryTimer}s
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cash Detail Modal */}
      {showCashModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative border dark:border-slate-800">
            <button onClick={() => setShowCashModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600"><X size={24} /></button>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3">
              <Wallet className="text-[#3a5ba1]" /> Detalle de Liquidez
            </h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {Object.entries(summary.cashByBroker).map(([broker, amount]) => (
                <div key={broker} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border flex justify-between items-center">
                  <span className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight text-sm">{broker}</span>
                  <span className="font-black text-slate-900 dark:text-white text-lg">${amount.toLocaleString()}</span>
                </div>
              ))}
              {Object.entries(summary.cashByBroker).length === 0 && <p className="text-center text-slate-400 py-10">No se registra liquidez disponible.</p>}
            </div>
            <button onClick={() => setShowCashModal(false)} className="w-full mt-8 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black rounded-2xl">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};
