
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User as UserIcon, Mail, Lock, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { User, RiskProfile } from '../types';
import { supabase } from '../lib/supabase';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: name
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    if (data.user) {
      // Create user profile in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          { 
            id: data.user.id, 
            email, 
            name, 
            risk_profile: RiskProfile.MODERATE 
          }
        ]);
      
      if (profileError) {
        console.error('Error creating profile:', profileError);
      }
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#14171e] flex items-center justify-center p-4 font-sans text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-[440px] overflow-hidden rounded-xl bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header Section */}
        <div className="relative w-full h-32 bg-[#3a5ba1]/10 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-60" 
            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuD1WIIYSFClw7TUhYhxuQFBqrAfK1CqjYp7DyxARff7Ib-Y0Lzv38IMky5w_d5FWQH1aOKQMdFtz_spB0dK9a3uuTMAYZyRLkJQaHJrjZ8WR0iJCFD7OJkAonILfcAeJN-TbFKMR0wztmBFMfjLZIjJwgYchZxCqU9BFp_hAv2T1kFJEpeu6YRdQZLcR2WFzHD_3wfzCBs7fQG6dhakMA0t-1SqiJByWqB0VkL0opQe9rkUvIYEbt1iG43ldj56GzaDFCSkErjj0XY')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900/50 to-transparent"></div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pt-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden shadow-lg border border-white/10 bg-transparent">
              <img 
                alt="Premium fintech logo" 
                className="w-full h-full object-contain rounded-xl" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5354n_LayEuxsiHuippp-qSrZaYyD0kqi8rdCzBUZpPvpcHhyqxkyxegKgqTnJwsPccK8VUgePW_VkK6520lDMSu1qkRcPJs1vx-ujHNY54B2p8KPdX7ITfOOwzDMe5yWIs1MVvThDOZz05QKOJdPic6BHTBfDcpv5MTVNQSZwpsFwptgf7N-vXqZ9OkrImpHOeVyKvV31-Vg2ndYKcsxf3UA1KmFE2VOpPxbG5h32ucj1vk_aZb0DD_J0wBUulTVU5ewXOJS0Rk"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Control de Cartera</h2>
          </div>
        </div>

        <div className="px-8 py-8 md:px-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Crea tu cuenta</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Gestiona tus inversiones de manera inteligente y profesional.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 p-3 rounded-lg text-sm font-medium text-center">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="name">Nombre completo</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  id="name"
                  type="text" 
                  required
                  placeholder="Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#3a5ba1] focus:border-transparent outline-none transition-all dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  id="email"
                  type="email" 
                  required
                  placeholder="nombre@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#3a5ba1] focus:border-transparent outline-none transition-all dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  id="password"
                  type="password" 
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#3a5ba1] focus:border-transparent outline-none transition-all dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="confirmPassword">Confirmar Contraseña</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  id="confirmPassword"
                  type="password" 
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#3a5ba1] focus:border-transparent outline-none transition-all dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-[#3a5ba1] hover:bg-[#3a5ba1]/90 text-white font-semibold py-3.5 rounded-lg shadow-lg shadow-[#3a5ba1]/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Crear mi Cuenta
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              ¿Ya tienes una cuenta? 
              <Link to="/login" className="text-[#3a5ba1] hover:underline font-bold ml-1">Inicia Sesión</Link>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-center gap-6">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">Seguridad Cifrada</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">256-bit SSL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

