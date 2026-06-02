
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const LOGO_URL = 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5354n_LayEuxsiHuippp-qSrZaYyD0kqi8rdCzBUZpPvpcHhyqxkyxegKgqTnJwsPccK8VUgePW_VkK6520lDMSu1qkRcPJs1vx-ujHNY54B2p8KPdX7ITfOOwzDMe5yWIs1MVvThDOZz05QKOJdPic6BHTBfDcpv5MTVNQSZwpsFwptgf7N-vXqZ9OkrImpHOeVyKvV31-Vg2ndYKcsxf3UA1KmFE2VOpPxbG5h32ucj1vk_aZb0DD_J0wBUulTVU5ewXOJS0Rk';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('LOGIN DEBUG: handleSubmit disparado para', email);
    setIsSubmitting(true);
    setError('');

    try {
      console.log('LOGIN DEBUG: Llamando a signInWithPassword...');
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log('LOGIN DEBUG: Respuesta recibida', { success: !loginError, error: loginError?.message });

      if (loginError) {
        setError(loginError.message === 'Invalid login credentials' ? 'Credenciales inválidas.' : loginError.message);
        setIsSubmitting(false);
      } else {
        console.log('LOGIN DEBUG: Exito. Esperando cambio de estado en App (onAuthStateChange)...');
        // Si después de 10 segundos no ha cambiado la vista, permitimos reintentar
        setTimeout(() => setIsSubmitting(false), 10000);
      }
    } catch (err: any) {
      console.error('LOGIN DEBUG: ERROR EXCEPCION:', err);
      setError('Ocurrió un error inesperado al iniciar sesión.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#14171e] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#3a5ba1]/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-[#3a5ba1]/10 blur-[120px] rounded-full" />
      </div>

      <main className="w-full max-w-[440px]">
        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-8 md:p-10">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-6 shadow-lg bg-transparent">
              <img 
                src={LOGO_URL} 
                alt="Premium fintech logo" 
                className="w-full h-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-center">Control de Cartera</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-center">Gestione sus activos con precisión profesional</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 p-3 rounded-lg text-sm font-medium text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="email">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  id="email"
                  type="email" 
                  required
                  autoComplete="email"
                  placeholder="demo@cartera.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#3a5ba1] focus:border-transparent outline-none transition-all dark:text-white"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
                  Contraseña
                </label>
                <Link to="/forgot-password" title="¿Olvidó su contraseña?" className="text-xs font-semibold text-[#3a5ba1] hover:underline transition-all">
                  ¿Olvidó su contraseña?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  id="password"
                  type={showPassword ? "text" : "password"} 
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#3a5ba1] focus:border-transparent outline-none transition-all dark:text-white"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-[#3a5ba1] focus:ring-[#3a5ba1] dark:bg-slate-800 dark:border-slate-700"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label className="ml-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer" htmlFor="remember">
                Recordar mi sesión
              </label>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-[#3a5ba1] hover:bg-[#3a5ba1]/90 text-white font-semibold py-3.5 rounded-lg shadow-lg shadow-[#3a5ba1]/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Entrar a mi Cartera
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              ¿No tiene una cuenta? {' '}
              <Link to="/register" className="text-[#3a5ba1] font-bold hover:underline ml-1">Regístrese ahora</Link>
            </p>
          </div>
        </div>
        
        <div className="mt-8 text-center text-slate-400 text-xs">
          Ingrese sus credenciales de acceso para continuar.
        </div>
      </main>

      <div className="fixed bottom-6 right-6">
        <button 
          type="button"
          className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-[#3a5ba1] dark:hover:text-[#3a5ba1] transition-colors"
          onClick={() => alert('Soporte: usa las credenciales demo para ingresar.')}
        >
          <HelpCircle size={24} />
        </button>
      </div>
    </div>
  );
};
