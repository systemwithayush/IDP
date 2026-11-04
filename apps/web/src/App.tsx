import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  Terminal, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  History, 
  PlusCircle, 
  Server, 
  Activity,
  GitBranch,
  Boxes
} from 'lucide-react';

function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-500" />
            Engineering Fleet Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of services, production rollouts, and cluster resource utilization.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/services/new"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Service
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Services</span>
            <Boxes className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">12</div>
          <div className="text-[11px] text-emerald-400 mt-1">● 100% healthy across teams</div>
        </div>

        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Deployments (24h)</span>
            <GitBranch className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">38</div>
          <div className="text-[11px] text-slate-400 mt-1">97.4% success rate</div>
        </div>

        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Mean Time to Deploy</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">4m 12s</div>
          <div className="text-[11px] text-emerald-400 mt-1">↓ 18s faster than avg</div>
        </div>

        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cluster Quota Usage</span>
            <Cpu className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">54%</div>
          <div className="text-[11px] text-slate-400 mt-1">8,600 / 16,000 mCPU</div>
        </div>
      </div>

      {/* Recent Deployments Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-slate-900/50">
          <span className="text-xs font-semibold text-slate-200">Active Deployments & Live Status</span>
          <span className="text-[11px] text-slate-400 font-mono">Socket.io Connected</span>
        </div>
        <div className="divide-y divide-border text-xs">
          <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <div>
                <span className="font-semibold text-white">auth-gateway</span>
                <span className="text-slate-400 font-mono ml-2">v1.4.2 (sha: 8f3c1a2)</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-mono">
                succeeded
              </span>
              <span>prod (2 replicas)</span>
              <span className="font-mono text-[11px]">3m ago</span>
            </div>
          </div>

          <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <div>
                <span className="font-semibold text-white">payment-processor</span>
                <span className="text-slate-400 font-mono ml-2">v2.1.0-rc1</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span className="bg-blue-950 text-blue-400 border border-blue-800 px-2 py-0.5 rounded text-[10px] font-mono">
                rolling_out
              </span>
              <span>staging</span>
              <span className="font-mono text-[11px]">Just now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Activity },
    { name: 'Service Catalogue', path: '/services', icon: Layers },
    { name: 'Deployments', path: '/deployments', icon: GitBranch },
    { name: 'AI Advisory', path: '/recommendations', icon: Cpu },
    { name: 'Team Quotas', path: '/quotas', icon: ShieldCheck },
    { name: 'Audit Log', path: '/audit', icon: History },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      {/* Top Header */}
      <header className="h-12 border-b border-border bg-[#0d131f] flex items-center justify-between px-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-sm font-bold text-white tracking-wider">
            <Terminal className="w-4 h-4 text-blue-500" />
            <span>INTERNAL DEVELOPER PLATFORM</span>
          </div>
          <span className="bg-blue-900/50 text-blue-400 text-[10px] font-mono px-2 py-0.5 rounded border border-blue-700/50">
            v1.0.0-phase0
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Cluster: idp-local</span>
          </div>
          <div className="h-3.5 w-px bg-border"></div>
          <div className="text-slate-300 font-mono bg-slate-800 px-2 py-1 rounded border border-border">
            admin1@idp.internal (admin)
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border bg-[#0a0e1a] p-3 space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 px-2 py-1">
            Core Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 max-w-7xl">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

