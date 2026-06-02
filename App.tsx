
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { Portfolio } from './views/Portfolio';
import { AssetDetail } from './views/AssetDetail';
import { Dividends } from './views/Dividends';
import { Alerts } from './views/Alerts';
import { Import } from './views/Import';
import { Settings } from './views/Settings';
import { AiRecommendations } from './views/AiRecommendations';
import { Login } from './views/Login';
import { Register } from './views/Register';
import { ForgotPassword } from './views/ForgotPassword';
import { DevDb } from './views/DevDb';
import { supabase } from './lib/supabase';
import { SupabaseService } from './services/supabaseService';
import { 
  User, Asset, Position, Broker, DividendEvent, AlertRule, 
  PriceSnapshot, PortfolioEvent, AssetFundamentals, NotificationLog,
  BrokerBalance, RiskProfile
} from './types';
import { DividendService } from './services/dividendService';
import { NotificationService } from './services/notificationService';
import { withTimeout } from './utils/promiseUtils';
import { Loader2, AlertCircle, RefreshCw, ChevronRight, TriangleAlert, X } from 'lucide-react';

const App: React.FC = () => {
  const bootstrapInFlight = useRef(false);
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isDegraded, setIsDegraded] = useState(false);
  const [degradedModules, setDegradedModules] = useState<string[]>([]);
  const [moduleErrors, setModuleErrors] = useState<Record<string, any>>({});
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ module: string; details: string } | null>(null);

  // Application Data States
  const [assets, setAssets] = useState<Asset[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [balances, setBalances] = useState<BrokerBalance[]>([]);
  const [dividends, setDividends] = useState<DividendEvent[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [portfolioEvents, setPortfolioEvents] = useState<PortfolioEvent[]>([]);
  const [fundamentals, setFundamentals] = useState<AssetFundamentals[]>([]);

  const TIMEOUT_CRITICAL = 25000; 

  const fetchUserData = useCallback(async (userId: string) => {
    console.log(`[BOOTSTRAP] ${new Date().toISOString()} - INICIANDO CARGA DE DATOS`);
    setDataLoading(true);
    const globalStart = Date.now();
    
    const trace = async (label: string, task: Promise<any>) => {
      const start = Date.now();
      try {
        const result = await task;
        console.log(`[BOOTSTRAP] ${label}_OK (${Date.now() - start}ms)`);
        
        // Si el módulo tiene éxito, lo quitamos de la lista de degradados por si estaba de antes
        setDegradedModules(prev => prev.filter(m => m !== label.toLowerCase()));
        return result;
      } catch (err: any) {
        console.error(`[BOOTSTRAP] ${label}_FAIL:`, err);
        setDegradedModules(prev => Array.from(new Set([...prev, label.toLowerCase()])));
        setModuleErrors(prev => ({ ...prev, [label.toLowerCase()]: err }));
        setIsDegraded(true);
        return null;
      }
    };

    try {
      // Cargamos en paralelo todos los módulos secundarios
      const [brokersRes, assetsRes, positionsRes, snapshotsRes, adjustmentsRes, eventsRes] = await Promise.all([
        trace('BROKERS', SupabaseService.brokers.listByUser(userId)),
        trace('ASSETS', SupabaseService.assets.listRaw()),
        trace('POSITIONS', SupabaseService.positions.listByUser(userId)),
        trace('SNAPSHOTS', SupabaseService.priceSnapshots.listRecent(500, userId)),
        trace('ADJUSTMENTS', SupabaseService.accountAdjustments.listByUser(userId)),
        trace('EVENTS', SupabaseService.portfolioEvents.listByUser(userId))
      ]);
      
      if (brokersRes) setBrokers(brokersRes);
      if (assetsRes) setAssets(assetsRes);
      if (positionsRes) setPositions(positionsRes);
      if (snapshotsRes) setSnapshots(snapshotsRes);
      if (adjustmentsRes) {
        setBalances((adjustmentsRes as any).map((adj: any) => ({
          ...adj,
          cashBalance: adj.amount,
          brokerId: adj.brokerId || ''
        })));
      }
      if (eventsRes) setPortfolioEvents(eventsRes);

      console.log(`[BOOTSTRAP] CARGA COMPLETA en ${Date.now() - globalStart}ms`);
      setDataLoading(false);

    } catch (err: any) {
      console.error('[BOOTSTRAP] Error masivo en fetchUserData:', err);
      setIsDegraded(true);
      setDataLoading(false);
    }
  }, []);

  const fetchUserProfile = useCallback(async (authUser: any) => {
    if (bootstrapInFlight.current) return;
    const userId = authUser.id;
    bootstrapInFlight.current = true;
    
    // Reset de estados de error al reintentar
    setBootstrapError(null);
    setErrorInfo(null);
    setIsDegraded(false);
    setDegradedModules([]);
    setModuleErrors({});
    setAuthLoading(true);

    const start = Date.now();

    // 1. Identidad básica para no bloquear la app si el perfil falla
    const tempUser: User = {
      id: userId,
      email: authUser.email || '',
      name: authUser.user_metadata?.full_name || 'Inversionista',
      riskProfile: RiskProfile.MODERATE,
      createdAt: new Date().toISOString(),
      pushEnabled: false,
      emailNotificationsEnabled: false,
      dividendAlertDays: 7
    };
    setUser(tempUser);
    setAuthLoading(false);

    try {
      // 2. Intentar obtener perfil real
      const profilePromise = withTimeout(
        SupabaseService.profiles.get(userId),
        TIMEOUT_CRITICAL,
        'profiles.get'
      ).then(profile => {
        if (profile) {
          setUser(profile);
          // Limpiar error de perfil si tuvo éxito (importante para refrescos)
          setDegradedModules(prev => prev.filter(m => m !== 'perfil'));
          return profile;
        }
        return null;
      }).catch(err => {
        console.warn('[BOOTSTRAP] Perfil no disponible via API, usando temporal.', err);
        setIsDegraded(true);
        setDegradedModules(prev => Array.from(new Set([...prev, 'perfil'])));
        setModuleErrors(prev => ({ ...prev, perfil: err }));
        return null;
      });

      // 3. Cargar datos de la cartera
      const dataPromise = fetchUserData(userId);

      await Promise.all([profilePromise, dataPromise]);

    } catch (err: any) {
      console.error('[BOOTSTRAP] Error fatal en secuencia:', err);
      setBootstrapError('Fallo de sincronización inicial.');
      setErrorInfo({ module: 'Sistema', details: err.message || 'Desconocido' });
    } finally {
      bootstrapInFlight.current = false;
    }
  }, [fetchUserData]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && !bootstrapInFlight.current) fetchUserProfile(session.user);
      else if (!session) setAuthLoading(false);
    }).catch(err => {
      console.error("[BOOTSTRAP] Error sesión:", err);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && _event === 'SIGNED_IN' && !bootstrapInFlight.current) {
        fetchUserProfile(session.user);
      } else if (_event === 'SIGNED_OUT') {
        setUser(null);
        clearAllData();
        setAuthLoading(false);
        setDataLoading(false);
        setIsDegraded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const clearAllData = () => {
    setAssets([]); setPositions([]); setBrokers([]); setBalances([]);
    setPortfolioEvents([]); setDividends([]); setAlerts([]); setSnapshots([]);
  };

  const handleRetry = () => {
    if (session?.user) fetchUserProfile(session.user);
    else window.location.reload();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-[9999] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-[#3a5ba1] animate-spin mb-4" />
        <h2 className="text-white text-xl font-black mb-2 uppercase tracking-tight">Cargando Cartera</h2>
        <p className="text-slate-500 font-bold tracking-widest text-[9px] animate-pulse">SINCRONIZANDO CON SUPABASE...</p>
      </div>
    );
  }

  if (!user && !bootstrapError) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex flex-col">
        {isDegraded && (
          <div className="bg-amber-500 text-white px-4 py-2 text-center text-[10px] font-black tracking-widest flex items-center justify-center gap-2 z-[60]">
            <TriangleAlert size={12} />
            DATOS PARCIALES: FALLÓ {degradedModules.length > 0 ? degradedModules.join(', ').toUpperCase() : 'CONEXIÓN'}
            <button onClick={() => setIsDegraded(false)} className="ml-4 p-1 hover:bg-white/20 rounded-full">
              <X size={12} />
            </button>
          </div>
        )}

        {bootstrapError && (
          <div className="bg-rose-600 text-white px-4 py-3 text-center text-[10px] font-black tracking-widest flex items-center justify-center gap-3 z-[60] shadow-2xl">
            <TriangleAlert size={14} />
            <span>ERROR CRÍTICO: {bootstrapError.toUpperCase()}</span>
            <button onClick={handleRetry} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg border border-white/20 ml-4">
              REINTENTAR
            </button>
          </div>
        )}

        {dataLoading && (
          <div className="fixed top-0 left-0 right-0 h-0.5 z-[100] bg-indigo-500/20 overflow-hidden">
            <div className="h-full bg-indigo-500 animate-[loading-bar_1.5s_infinite_linear]" style={{ width: '40%' }} />
          </div>
        )}
        
        <Layout user={user || { id: '', email: '', name: 'Inversionista', riskProfile: RiskProfile.MODERATE } as User} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={
              (isDegraded || bootstrapError) && !dataLoading && assets.length === 0 && positions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                   <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto border-2 border-rose-100 dark:border-rose-900/30">
                     <AlertCircle size={40} />
                   </div>
                   <div className="space-y-2">
                     <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase">No hay datos disponibles</h2>
                     <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
                       Hubo un problema al recuperar tu cartera. Si acabas de empezar, prueba a importar tus activos.
                     </p>
                   </div>
                   <div className="flex gap-4">
                     <button onClick={handleRetry} className="px-8 py-3 bg-[#3a5ba1] text-white font-black rounded-2xl text-[11px] uppercase tracking-widest">Reintentar</button>
                     <a href="#/import" className="px-8 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border font-black rounded-2xl text-[11px] uppercase tracking-widest">Ir a Importar</a>
                   </div>
                </div>
              ) : (
                <Dashboard assets={assets} setAssets={setAssets} positions={positions} brokers={brokers} balances={balances} snapshots={snapshots} setSnapshots={setSnapshots} fundamentals={fundamentals} user={user} alerts={alerts} setNotificationLogs={setNotificationLogs} dividends={dividends} portfolioEvents={portfolioEvents} />
              )
            } />
            <Route path="/assets" element={<Portfolio assets={assets} setAssets={setAssets} positions={positions} setPositions={setPositions} brokers={brokers} balances={balances} snapshots={snapshots} setPortfolioEvents={setPortfolioEvents} user={user} />} />
            <Route path="/assets/:assetId" element={<AssetDetail assets={assets} setAssets={setAssets} positions={positions} setPositions={setPositions} brokers={brokers} balances={balances} snapshots={snapshots} portfolioEvents={portfolioEvents} setPortfolioEvents={setPortfolioEvents} fundamentals={fundamentals} setFundamentals={setFundamentals} user={user} />} />
            <Route path="/dividends" element={<Dividends dividends={dividends} setDividends={setDividends} assets={assets} setAssets={setAssets} brokers={brokers} positions={positions} setPositions={setPositions} setPortfolioEvents={setPortfolioEvents} user={user} />} />
            <Route path="/alerts" element={<Alerts alerts={alerts} setAlerts={setAlerts} notificationLogs={notificationLogs} setNotificationLogs={setNotificationLogs} user={user} setUser={setUser} assets={assets} />} />
            <Route path="/ai" element={<AiRecommendations assets={assets} positions={positions} brokers={brokers} user={user} fundamentals={fundamentals} snapshots={snapshots} />} />
            <Route path="/import" element={<Import user={user || { id: '', email: '', name: 'Inversionista' } as User} onRefresh={() => fetchUserData(user?.id || '')} />} />
            <Route path="/settings" element={<Settings user={user || { id: '', email: '', name: 'Inversionista' } as User} setUser={setUser} assets={assets} positions={positions} brokers={brokers} balances={balances} fundamentals={fundamentals} snapshots={snapshots} onResetData={handleResetData} />} />
            <Route path="/dev/db" element={<DevDb assets={assets} positions={positions} brokers={brokers} portfolioEvents={portfolioEvents} balances={balances} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </div>
    </HashRouter>
  );

  async function handleResetData() {
    if (!user) return;
    try {
      console.log(`[APP] Iniciando limpieza profunda para usuario: ${user.id}`);
      await SupabaseService.resetUserData(user.id);
      
      // Limpiar estado local
      clearAllData();
      
      // Recargar datos (que ahora están vacíos en DB) para sincronizar UI
      await fetchUserData(user.id);
      console.log(`[APP] Limpieza completada con éxito`);
    } catch (err) {
      console.error("[APP] Error al limpiar la base de datos:", err);
      alert("Hubo un error al intentar borrar los datos. Por favor, reintenta.");
    }
  }
};

export default App;
