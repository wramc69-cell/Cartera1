
import React, { useState } from 'react';
import { 
  Bell, ToggleLeft, ToggleRight, Trash2, ArrowUpCircle, ArrowDownCircle, 
  Plus, Settings2, History, CheckCircle2, XCircle, Mail, Smartphone,
  AlertTriangle, Filter, ChevronRight, Save, Clock, FlaskConical, Loader2
} from 'lucide-react';
import { AlertRule, AlertRuleType, NotificationLog, User, Asset } from '../types';
import { NotificationService } from '../services/notificationService';

interface AlertsProps {
  alerts: AlertRule[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertRule[]>>;
  notificationLogs: NotificationLog[];
  setNotificationLogs: React.Dispatch<React.SetStateAction<NotificationLog[]>>;
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  assets: Asset[];
}

export const Alerts: React.FC<AlertsProps> = ({ 
  alerts, setAlerts, notificationLogs, setNotificationLogs, user, setUser, assets 
}) => {
  const [activeTab, setActiveTab] = useState<'RULES' | 'HISTORY'>('RULES');
  const [isAdding, setIsAdding] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // New Alert State
  const [newType, setNewType] = useState<AlertRuleType>(AlertRuleType.DROP_PCT_1D);
  const [newSymbol, setNewSymbol] = useState('');
  const [newThreshold, setNewThreshold] = useState(10);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isEnabled: !a.isEnabled } : a));
  };

  const deleteAlert = (id: string) => {
    if (confirm('¿Eliminar esta regla de alerta?')) {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }
  };

  const togglePush = async () => {
    if (!user.pushEnabled) {
      const granted = await NotificationService.requestPushPermission();
      if (granted) {
        setUser(prev => prev ? { ...prev, pushEnabled: true } : null);
      } else {
        alert('Permisos de notificación denegados por el navegador.');
      }
    } else {
      setUser(prev => prev ? { ...prev, pushEnabled: false } : null);
    }
  };

  const handleSimulateAlert = async () => {
    setIsSimulating(true);
    
    // Check for push permission if not enabled
    if (!user.pushEnabled) {
      const granted = await NotificationService.requestPushPermission();
      if (granted) {
        setUser(prev => prev ? { ...prev, pushEnabled: true } : null);
      }
    }

    const title = "🚨 ALERTA CRÍTICA SIMULADA";
    const message = "Bitcoin (BTC) ha caído un 15% en las últimas 2 horas. Revisa tu estrategia.";

    // Simulate multi-channel send
    const emailLog = await NotificationService.sendEmail(user, title, message);
    const pushLog = await NotificationService.sendPush(user.id, title, message);

    setNotificationLogs(prev => [pushLog, emailLog, ...prev]);
    setIsSimulating(false);
    setActiveTab('HISTORY');
  };

  const handleAddAlert = () => {
    const newAlert: AlertRule = {
      id: `alert_${Date.now()}`,
      userId: user.id,
      type: newType,
      symbol: newSymbol || undefined,
      threshold: newThreshold,
      isEnabled: true
    };
    setAlerts(prev => [newAlert, ...prev]);
    setIsAdding(false);
    setNewSymbol('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Bell className="text-indigo-600" size={32} />
            Alertas y Notificaciones
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Gestiona cómo y cuándo quieres ser notificado.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('RULES')}
            className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 ${activeTab === 'RULES' ? 'bg-white shadow-sm border text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Settings2 size={18} /> Reglas
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-white shadow-sm border text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <History size={18} /> Historial
          </button>
        </div>
      </header>

      {/* Global Notification Settings */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 p-8 opacity-5">
           <Smartphone size={120} />
        </div>
        <div className="space-y-2 relative z-10">
          <h3 className="text-xl font-black flex items-center gap-3">
            <Smartphone className="text-indigo-400" />
            Notificaciones Push
          </h3>
          <p className="text-slate-400 text-sm max-w-md">
            Recibe alertas críticas directamente en tu escritorio o móvil incluso si la aplicación está cerrada.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 relative z-10">
          <button 
            onClick={handleSimulateAlert}
            disabled={isSimulating}
            className="px-6 py-4 rounded-2xl font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {isSimulating ? <Loader2 className="animate-spin" size={16} /> : <FlaskConical size={16} />}
            {isSimulating ? 'Probando...' : 'Probar Notificación'}
          </button>
          <button 
            onClick={togglePush}
            className={`px-8 py-4 rounded-2xl font-black transition-all flex items-center gap-3 active:scale-95 ${user.pushEnabled ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            {user.pushEnabled ? <CheckCircle2 size={20} /> : <Smartphone size={20} />}
            {user.pushEnabled ? 'Push Activado' : 'Activar Navegador'}
          </button>
        </div>
      </div>

      {activeTab === 'RULES' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
             <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Mis Reglas Activas</h3>
             <button 
              onClick={() => setIsAdding(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-100"
             >
               <Plus size={16} /> Nueva Regla
             </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {alerts.map((alert) => (
              <div key={alert.id} className={`bg-white p-6 rounded-[2rem] border-2 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${alert.isEnabled ? 'border-slate-100' : 'opacity-60 grayscale'}`}>
                <div className="flex items-center gap-6">
                  <div className={`p-4 rounded-3xl ${
                    alert.type === AlertRuleType.DROP_PCT_1D ? 'bg-rose-50 text-rose-600' :
                    alert.type === AlertRuleType.CONCENTRATION ? 'bg-amber-50 text-amber-600' :
                    alert.type === AlertRuleType.DAILY_RED ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <AlertRuleIcon type={alert.type} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">
                        {alert.symbol || 'Cartera Global'}
                      </h4>
                      <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full tracking-tighter uppercase">
                        {alert.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">
                      {getRuleDescription(alert)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                   <button 
                    onClick={() => toggleAlert(alert.id)}
                    className={`p-2 rounded-full transition-colors ${alert.isEnabled ? 'text-indigo-600 bg-indigo-50' : 'text-slate-300 bg-slate-50'}`}
                   >
                     {alert.isEnabled ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                   </button>
                   <button 
                    onClick={() => deleteAlert(alert.id)}
                    className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                   >
                     <Trash2 size={20} />
                   </button>
                </div>
              </div>
            ))}
            
            {alerts.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <Bell className="mx-auto text-slate-200 mb-4" size={48} />
                <p className="text-slate-400 font-medium italic">No has configurado reglas aún.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
             <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Registro de Notificaciones</h3>
             <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
               <Filter size={14} /> Filtrar por Canal
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {notificationLogs.map((log) => (
                <div key={log.id} className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${log.status === 'SENT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                      {log.channel === 'EMAIL' ? <Mail size={20} /> : <Smartphone size={20} />}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{log.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{log.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                          <Clock size={10} /> {new Date(log.sentAt).toLocaleString()}
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${log.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {log.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-white rounded-2xl transition-all active:scale-90">
                    <ChevronRight size={20} />
                  </button>
                </div>
              ))}
              {notificationLogs.length === 0 && (
                <div className="p-20 text-center text-slate-300 italic">No hay historial de notificaciones.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW ALERT MODAL */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
              <button onClick={() => setIsAdding(false)} className="text-slate-300 hover:text-slate-900 transition-colors"><Trash2 size={24} /></button>
            </div>
            
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm border border-indigo-100">
                  <Plus size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Nueva Regla</h3>
                  <p className="text-slate-500 font-medium">Configura una alerta inteligente</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo de Regla</label>
                  <select 
                    value={newType} 
                    onChange={e => setNewType(e.target.value as AlertRuleType)}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-800"
                  >
                    <option value={AlertRuleType.DROP_PCT_1D}>CAÍDA PORCENTUAL (1D)</option>
                    <option value={AlertRuleType.DAILY_RED}>ACTIVO EN ROJO (DAILY)</option>
                    <option value={AlertRuleType.CONCENTRATION}>EXCESO CONCENTRACIÓN</option>
                  </select>
                </div>

                {newType !== AlertRuleType.DAILY_RED || newSymbol !== '' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Símbolo (Activo)</label>
                    <select 
                      value={newSymbol} 
                      onChange={e => setNewSymbol(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-800"
                    >
                      <option value="">Cartera Global</option>
                      {assets.map(a => <option key={a.id} value={a.symbol}>{a.symbol} - {a.name}</option>)}
                    </select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Umbral (Threshold %)</label>
                  <input 
                    type="number" 
                    value={newThreshold}
                    onChange={e => setNewThreshold(parseFloat(e.target.value))}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-800"
                    placeholder="Ej: 10"
                  />
                  <p className="text-[9px] text-slate-400 italic px-1">Se disparará cuando el valor supere este porcentaje.</p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={handleAddAlert}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                  >
                    Guardar Regla
                  </button>
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all"
                  >
                    Cerrar
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

const AlertRuleIcon = ({ type }: { type: AlertRuleType }) => {
  switch (type) {
    case AlertRuleType.DAILY_RED: return <XCircle size={24} />;
    case AlertRuleType.DROP_PCT_1D: return <ArrowDownCircle size={24} />;
    case AlertRuleType.CONCENTRATION: return <AlertTriangle size={24} />;
    default: return <Bell size={24} />;
  }
};

const getRuleDescription = (rule: AlertRule): string => {
  switch (rule.type) {
    case AlertRuleType.DAILY_RED: 
      return `Notificar si ${rule.symbol || 'la cartera'} cierra con P&L negativo hoy.`;
    case AlertRuleType.DROP_PCT_1D:
      return `Avisar si ${rule.symbol} cae más de un ${rule.threshold}% en un solo día.`;
    case AlertRuleType.CONCENTRATION:
      return `Alerta si ${rule.symbol} supera el ${rule.threshold}% del peso total de la cartera.`;
    default:
      return 'Regla de alerta configurada.';
  }
};
