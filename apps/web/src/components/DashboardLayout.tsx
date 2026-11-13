import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { LogOut, ChevronRight, Cpu, Menu, X } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface DashboardLayoutProps {
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

const ROLE_BADGE: Record<UserRole, { label: string; cls: string }> = {
  admin:     { label: 'ADMIN', cls: 'text-purple-400 bg-purple-900/40 border-purple-700/50' },
  lead:      { label: 'LEAD',  cls: 'text-blue-400   bg-blue-900/40   border-blue-700/50' },
  developer: { label: 'DEV',   cls: 'text-emerald-400 bg-emerald-900/40 border-emerald-700/50' },
};

const AVATAR_BG: Record<UserRole, string> = {
  admin:     'bg-gradient-to-br from-purple-600 to-indigo-700',
  lead:      'bg-gradient-to-br from-blue-600 to-cyan-700',
  developer: 'bg-gradient-to-br from-emerald-600 to-teal-700',
};

export default function DashboardLayout({ navItems, activeTab, onTabChange, children, headerRight }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  const badge = ROLE_BADGE[user.role];
  const avatarBg = AVATAR_BG[user.role];
  const initials = user.name.slice(0, 2).toUpperCase();

  const Sidebar = () => (
    <aside className="w-56 shrink-0 bg-[#0a0e1a] border-r border-slate-800/70 flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-800/70 flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <span className="text-white font-mono font-bold text-sm">IDP</span>
        <span className="ml-auto px-1.5 py-0.5 text-[9px] font-mono font-bold bg-blue-900/40 text-blue-400 border border-blue-700/50 rounded">
          PLATFORM
        </span>
      </div>

      {/* Nav items — scrollable */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 custom-scrollbar">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { onTabChange(item.id); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm font-mono transition-all group ${
              activeTab === item.id
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <span className={`shrink-0 ${activeTab === item.id ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
            {activeTab === item.id && (
              <ChevronRight className="w-3 h-3 ml-auto text-blue-500" />
            )}
          </button>
        ))}
      </nav>

      {/* User card */}
      <div className="px-3 py-3 border-t border-slate-800/70 shrink-0">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className={`w-8 h-8 rounded-md ${avatarBg} flex items-center justify-center text-white text-xs font-bold font-mono shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-slate-200 text-xs font-mono font-semibold truncate">{user.name}</div>
            <div className="text-slate-600 text-[10px] font-mono truncate">{user.email}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${badge.cls}`}>
            {badge.label}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-slate-600 hover:text-red-400 transition-colors text-[11px] font-mono"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#090d16] flex">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex flex-col h-full">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#090d16]/95 backdrop-blur border-b border-slate-800/70 px-4 md:px-6 h-12 flex items-center gap-3 shrink-0">
          <button
            className="md:hidden text-slate-500 hover:text-slate-300 transition-colors"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2 font-mono text-sm text-slate-400">
            <span className="text-slate-600">IDP</span>
            <ChevronRight className="w-3 h-3 text-slate-700" />
            <span className="text-slate-300">
              {navItems.find((n) => n.id === activeTab)?.label ?? activeTab}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {headerRight}
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badge.cls}`}>
              {user.name} · {badge.label}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
