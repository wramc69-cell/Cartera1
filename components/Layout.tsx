
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  Coins, 
  Bell, 
  FileUp, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X,
  TrendingUp,
  Database,
  Brain
} from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Activos', path: '/assets', icon: Briefcase },
    { name: 'Asesor IA', path: '/ai', icon: Brain },
    { name: 'Dividendos', path: '/dividends', icon: Coins },
    { name: 'Alertas', path: '/alerts', icon: Bell },
    { name: 'Importar', path: '/import', icon: FileUp },
    { name: 'Ajustes', path: '/settings', icon: SettingsIcon },
  ];

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#14171e] flex flex-col md:flex-row transition-colors duration-300">
      {/* Mobile Nav */}
      <div className="md:hidden bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-[#3a5ba1] w-6 h-6" />
          <span className="font-bold text-slate-800 dark:text-white">Control Cartera</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-600 dark:text-slate-400">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900/80 backdrop-blur-xl border-r dark:border-slate-800 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col p-6">
          <div className="hidden md:flex items-center gap-3 mb-10">
            <div className="bg-[#3a5ba1] p-2 rounded-lg shadow-lg shadow-[#3a5ba1]/20">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl text-slate-800 dark:text-white">Control Cartera</span>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                    ${isActive 
                      ? 'bg-[#3a5ba1]/10 text-[#3a5ba1] font-semibold dark:bg-[#3a5ba1]/20 dark:text-blue-400' 
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-white'}
                  `}
                >
                  <Icon size={20} />
                  {item.name}
                </Link>
              );
            })}

            <div className="pt-4 mt-4 border-t dark:border-slate-800">
               <Link
                to="/dev/db"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-slate-400 hover:bg-slate-900 hover:text-indigo-400 group"
              >
                <Database size={20} className="group-hover:text-indigo-400" />
                <span className="text-sm font-bold uppercase tracking-widest opacity-60">Database (Dev)</span>
              </Link>
            </div>
          </nav>

          <div className="mt-auto pt-6 border-t dark:border-slate-800">
            <div className="flex items-center gap-3 px-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400">
                {user.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={20} />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-auto">
        {children}
      </main>
      
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};
