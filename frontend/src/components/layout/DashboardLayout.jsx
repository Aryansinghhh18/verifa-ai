import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Bot,
  PlayCircle,
  FileSpreadsheet,
  History,
  BarChart2,
  Settings,
  LogOut,
  ShieldCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, exact: true },
    { label: 'Chatbot Connections', to: '/dashboard/chatbots', icon: Bot },
    { label: 'New Evaluation', to: '/dashboard/new-eval', icon: PlayCircle },
    { label: 'Batch Evaluation', to: '/dashboard/batch', icon: FileSpreadsheet },
    { label: 'Evaluation History', to: '/dashboard/history', icon: History },
    { label: 'Analytics', to: '/dashboard/analytics', icon: BarChart2 },
    { label: 'Settings', to: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-surface-darkest text-slate-100 flex selection:bg-brand-yellow selection:text-black">
      {/* Sidebar */}
      <aside className="w-64 border-r border-surface-border bg-surface-dark flex flex-col shrink-0">
        {/* Brand */}
        <div className="h-16 px-6 border-b border-surface-border flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-yellow flex items-center justify-center font-black text-black text-base tracking-wider shadow-glow-yellow">
              V
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold tracking-tight text-white text-base">
                VeriFA <span className="text-brand-yellow">AI</span>
              </span>
              <span className="text-[9px] text-slate-400 -mt-1 tracking-widest font-mono">
                EVALUATION
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 px-3 py-1 font-semibold">
            Platform
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-surface-card border border-brand-yellow/30 text-brand-yellow font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-slate-400 border border-surface-border">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Engine Status pill */}
        <div className="p-4 border-t border-surface-border bg-surface-card/30">
          <div className="p-3 rounded-xl border border-surface-border bg-surface-card text-xs">
            <div className="flex items-center gap-2 text-brand-emerald font-semibold mb-1">
              <span className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse" />
              <span>HHEM Engine Online</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Vectara Cross-Encoder v2
            </div>
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-surface-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center font-bold text-xs text-brand-yellow shrink-0">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {user?.full_name || 'User'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono truncate">
                {user?.email || ''}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-surface-border bg-surface-dark/70 backdrop-blur-md px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Link to="/dashboard" className="hover:text-slate-200 transition-colors">VeriFA AI</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-brand-yellow font-semibold">Evaluation Workspace</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 border border-surface-border px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-hover transition-colors"
            >
              <span>Public Landing</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
