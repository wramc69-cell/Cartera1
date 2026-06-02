
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Mail, Loader2, ArrowLeft, CheckCircle2, HelpCircle } from 'lucide-react';

const LOGO_URL = 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5354n_LayEuxsiHuippp-qSrZaYyD0kqi8rdCzBUZpPvpcHhyqxkyxegKgqTnJwsPccK8VUgePW_VkK6520lDMSu1qkRcPJs1vx-ujHNY54B2p8KPdX7ITfOOwzDMe5yWIs1MVvThDOZz05QKOJdPic6BHTBfDcpv5MTVNQSZwpsFwptgf7N-vXqZ9OkrImpHOeVyKvV31-Vg2ndYKcsxf3UA1KmFE2VOpPxbG5h32ucj1vk_aZb0DD_J0wBUulTVU5ewXOJS0Rk';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Simulate sending reset email
    setTimeout(() => {
      if (email.includes('@')) {
        setIsSent(true);
      } else {
        setError('Por favor ingresa un correo electrónico válido.');
      }
      setIsSubmitting(false);
    }, 1500);
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
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-center">Recuperar contraseña</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-center">Te enviaremos instrucciones para restablecerla</p>
          </div>

          {!isSent ? (
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
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#3a5ba1] focus:border-transparent outline-none transition-all dark:text-white"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-[#3a5ba1] hover:bg-[#3a5ba1]/90 text-white font-semibold py-3.5 rounded-lg shadow-lg shadow-[#3a5ba1]/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  'Enviar enlace'
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-4 animate-in zoom-in-95 duration-500">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl mb-8 shadow-inner">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">¡Enlace enviado!</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium leading-relaxed">
                Hemos enviado las instrucciones para restablecer tu contraseña a <span className="font-bold text-slate-900 dark:text-white">{email}</span>.
              </p>
              <Link 
                to="/login" 
                className="inline-flex items-center gap-2 text-[#3a5ba1] font-bold hover:underline group"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                Volver a iniciar sesión
              </Link>
            </div>
          )}

          {!isSent && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
              <Link 
                to="/login" 
                className="inline-flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm font-bold uppercase tracking-widest hover:text-[#3a5ba1] transition-colors group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Volver al login
              </Link>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-6 right-6">
        <button 
          type="button"
          className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-[#3a5ba1] dark:hover:text-[#3a5ba1] transition-colors"
          onClick={() => alert('Soporte: ingresa tu correo para recibir un enlace de recuperación.')}
        >
          <HelpCircle size={24} />
        </button>
      </div>
    </div>
  );
};
