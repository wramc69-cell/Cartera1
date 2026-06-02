
import React, { useState } from 'react';
import { User, RiskProfile, Asset, Position, Broker, AssetFundamentals, PriceSnapshot, BrokerBalance } from '../types';
import { 
  Brain, Shield, Check, Loader2, Bell, Mail, 
  Smartphone, Calendar, ToggleLeft, ToggleRight, Save, Zap,
  Lock, Key, Eye, EyeOff, Trash2, AlertTriangle
} from 'lucide-react';
import { getAIRecommendations, AIRecommendationResponse } from '../services/geminiService';

interface SettingsProps {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  assets: Asset[];
  positions: Position[];
  brokers: Broker[];
  balances: BrokerBalance[];
  fundamentals: AssetFundamentals[];
  snapshots: PriceSnapshot[];
  onResetData: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  user, setUser, assets, positions, brokers, balances, fundamentals, snapshots, onResetData 
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIRecommendationResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [form, setForm] = useState({
    riskProfile: user.riskProfile,
    emailEnabled: user.emailNotificationsEnabled ?? true,
    pushEnabled: user.pushEnabled ?? false,
    dividendAlertDays: user.dividendAlertDays ?? 3
  });

  const handleSave = () => {
    setIsSaving(true);
    setSavedSuccess(false);
    setTimeout(() => {
      setUser({ 
        ...user, 
        riskProfile: form.riskProfile,
        emailNotificationsEnabled: form.emailEnabled,
        pushEnabled: form.pushEnabled,
        dividendAlertDays: form.dividendAlertDays
      });
      setIsSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }, 800);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);

    setTimeout(() => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setPasswordError('Las contraseñas nuevas no coinciden.');
        setIsChangingPassword(false);
        return;
      }
      if (passwordForm.newPassword.length < 8) {
        setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.');
        setIsChangingPassword(false);
        return;
      }
      
      setUser({ ...user, password: passwordForm.newPassword });
      setPasswordSuccess(true);
      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    }, 1500);
  };

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await getAIRecommendations(
      assets, 
      positions, 
      brokers, 
      form.riskProfile, 
      fundamentals, 
      snapshots,
      'es'
    );
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-fade-in pb-20">
      <header>
        <h1 className="text-4xl font-[800] text-slate-900 tracking-tight">Configuración</h1>
        <p className="text-slate-500 mt-2 text-lg font-medium">Personaliza los parámetros de tu perfil de inversor inteligente.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          {/* Risk Profile Section */}
          <section className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-xl font-[800] text-slate-800 tracking-tight">Perfil de Estrategia</h3>
                <p className="text-sm text-slate-400 font-medium">Define la agresividad de las recomendaciones de IA.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.values(RiskProfile).map((p) => (
                <button
                  key={p}
                  onClick={() => setForm(f => ({ ...f, riskProfile: p }))}
                  className={`
                    p-6 rounded-[2rem] border-2 text-left transition-all relative overflow-hidden group
                    ${form.riskProfile === p 
                      ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-500/10' 
                      : 'border-slate-100 hover:border-slate-200 bg-white'}
                  `}
                >
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${form.riskProfile === p ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {p === RiskProfile.CONSERVATIVE ? 'Seguridad Primero' : p === RiskProfile.MODERATE ? 'Balance Óptimo' : 'Crecimiento Máximo'}
                  </p>
                  <h4 className={`text-lg font-black ${form.riskProfile === p ? 'text-indigo-900' : 'text-slate-600'}`}>{p}</h4>
                  {form.riskProfile === p && <Check className="absolute top-4 right-4 text-indigo-600" size={20} />}
                </button>
              ))}
            </div>
          </section>

          {/* Notifications Section */}
          <section className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Bell size={24} />
              </div>
              <div>
                <h3 className="text-xl font-[800] text-slate-800 tracking-tight">Notificaciones</h3>
                <p className="text-sm text-slate-400 font-medium">Controla los canales de comunicación de alertas.</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              <div className="py-6 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${form.emailEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                    <Mail size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">Alertas por Correo</h4>
                    <p className="text-xs text-slate-400 font-medium">Resúmenes semanales y alertas críticas al email.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setForm(f => ({ ...f, emailEnabled: !f.emailEnabled }))}
                  className={`p-2 transition-colors ${form.emailEnabled ? 'text-indigo-600' : 'text-slate-200'}`}
                >
                  {form.emailEnabled ? <ToggleRight size={44} /> : <ToggleLeft size={44} />}
                </button>
              </div>

              <div className="py-6 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${form.pushEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">Push Notifications</h4>
                    <p className="text-xs text-slate-400 font-medium">Actualizaciones de mercado inmediatas en el navegador.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setForm(f => ({ ...f, pushEnabled: !f.pushEnabled }))}
                  className={`p-2 transition-colors ${form.pushEnabled ? 'text-indigo-600' : 'text-slate-200'}`}
                >
                  {form.pushEnabled ? <ToggleRight size={44} /> : <ToggleLeft size={44} />}
                </button>
              </div>
            </div>
          </section>

          {/* Dividend Settings */}
          <section className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
             <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Calendar size={24} />
              </div>
              <div>
                <h3 className="text-xl font-[800] text-slate-800 tracking-tight">Gestión de Dividendos</h3>
                <p className="text-sm text-slate-400 font-medium">Días de aviso previo para cobros programados.</p>
              </div>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-[2rem] border-2 border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="font-black text-slate-700">Anticipación de Alerta</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Avisar X días antes del pago</p>
              </div>
              <div className="flex items-center gap-4">
                 <input 
                  type="number" 
                  min="1" max="30"
                  value={form.dividendAlertDays}
                  onChange={e => setForm(f => ({ ...f, dividendAlertDays: parseInt(e.target.value) || 0 }))}
                  className="w-24 px-5 py-4 bg-white border-2 border-slate-200 rounded-2xl text-center font-black text-slate-800 focus:border-indigo-500 outline-none transition-all shadow-sm"
                 />
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Días</span>
              </div>
            </div>
          </section>

          {/* Security Section */}
          <section className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Lock size={24} />
              </div>
              <div>
                <h3 className="text-xl font-[800] text-slate-800 tracking-tight">Seguridad</h3>
                <p className="text-sm text-slate-400 font-medium">Actualiza tu contraseña para mantener tu cuenta segura.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              {passwordError && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-xs font-bold animate-shake">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-xs font-bold animate-fade-in">
                  ✓ Contraseña actualizada correctamente
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Contraseña Actual</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type={showPass.current ? "text" : "password"}
                      required
                      value={passwordForm.currentPassword}
                      onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-indigo-500 outline-none transition-all"
                      placeholder="••••••••"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPass(s => ({ ...s, current: !s.current }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      {showPass.current ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nueva Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type={showPass.new ? "text" : "password"}
                      required
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-indigo-500 outline-none transition-all"
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPass(s => ({ ...s, new: !s.new }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      {showPass.new ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Confirmar Nueva Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type={showPass.confirm ? "text" : "password"}
                      required
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-indigo-500 outline-none transition-all"
                      placeholder="Repite la contraseña"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPass(s => ({ ...s, confirm: !s.confirm }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      {showPass.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-lg shadow-rose-200 active:scale-[0.98] disabled:opacity-50"
                >
                  {isChangingPassword ? <Loader2 className="animate-spin" size={20} /> : <Shield size={20} />}
                  Actualizar Contraseña
                </button>
              </div>
            </form>
          </section>

          {/* Danger Zone Section */}
          <section className="bg-rose-50/30 p-8 rounded-[2.5rem] border border-rose-100 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-[800] text-rose-900 tracking-tight">Zona de Peligro</h3>
                <p className="text-sm text-rose-500 font-medium">Gestión crítica de la base de datos local.</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-rose-100 space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase tracking-tighter">Limpiar toda la base de datos</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Esta acción eliminará todos tus activos, posiciones, brokers, alertas e historial de dividendos. 
                    Tu cuenta de usuario se mantendrá activa. Esta acción <strong className="text-rose-600 uppercase">no se puede deshacer</strong>.
                  </p>
                </div>
              </div>

              {!showResetConfirm ? (
                <button 
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full py-3 text-rose-600 font-bold text-sm bg-rose-50 hover:bg-rose-100 rounded-xl transition-all border border-rose-100"
                >
                  Deseo limpiar mi base de datos
                </button>
              ) : (
                <div className="space-y-3 animate-in zoom-in-95 duration-200">
                  <p className="text-[10px] font-black text-rose-600 uppercase text-center">¿Estás absolutamente seguro?</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 py-3 text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => {
                        setIsResetting(true);
                        setTimeout(() => {
                          onResetData();
                          setIsResetting(false);
                          setShowResetConfirm(false);
                        }, 1500);
                      }}
                      disabled={isResetting}
                      className="flex-1 py-3 text-white font-bold text-sm bg-rose-600 hover:bg-rose-700 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {isResetting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      Sí, Limpiar Todo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4">
            {savedSuccess && <p className="text-emerald-600 font-black text-sm animate-pulse">✓ Cambios guardados correctamente</p>}
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-10 py-5 rounded-[2rem] font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
              Guardar Configuración
            </button>
          </div>
        </div>

        {/* AI Insight Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 bg-white/10 w-40 h-40 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl">
                  <Brain size={28} />
                </div>
                <h3 className="font-black text-xl tracking-tight">Gemini Consulting</h3>
              </div>
              <p className="text-indigo-100 text-sm leading-relaxed font-medium">
                Simula cómo Gemini 3 interpretará tu cartera bajo el perfil <span className="text-white font-black underline decoration-indigo-400 decoration-2">{form.riskProfile}</span>.
              </p>
              <button 
                onClick={runAIAnalysis}
                disabled={isAnalyzing}
                className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-black hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-900/20 active:scale-[0.98]"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                {isAnalyzing ? 'Simulando...' : 'Previsualizar Análisis'}
              </button>
            </div>
          </div>

          {aiAnalysis && (
            <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm animate-fade-in space-y-4">
              <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Insights del Perfil</h4>
              <div className="space-y-3">
                {aiAnalysis.assets.slice(0, 2).map((rec, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white group">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-black text-slate-800 text-xs">{rec.symbol}</p>
                      <span className="text-[9px] font-black text-indigo-600 bg-white px-2 py-0.5 rounded-lg border shadow-sm">{rec.action}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic line-clamp-2">"{rec.reasons[0]}"</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setAiAnalysis(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 w-full text-center py-2 border-t mt-4">Ocultar análisis</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
