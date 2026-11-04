import { useState } from 'react';
import { 
  Terminal, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  History, 
  Plus, 
  Activity,
  GitBranch,
  Boxes,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface ServiceItem {
  id: string;
  name: string;
  team: string;
  stack: 'node-express' | 'python-fastapi' | 'react-static';
  repoUrl: string;
  status: 'succeeded' | 'rolling_out' | 'failed' | 'building';
  replicas: string;
  env: 'prod' | 'staging' | 'dev';
  lastDeployed: string;
  cpuUsage: string;
  memUsage: string;
}

const INITIAL_SERVICES: ServiceItem[] = [
  {
    id: 'srv-1',
    name: 'auth-gateway',
    team: 'Platform Engineering',
    stack: 'node-express',
    repoUrl: 'github.com/systemwithayush/auth-gateway',
    status: 'succeeded',
    replicas: '2/2',
    env: 'prod',
    lastDeployed: '4m ago',
    cpuUsage: '140m / 500m',
    memUsage: '210Mi / 512Mi'
  },
  {
    id: 'srv-2',
    name: 'payment-processor',
    team: 'Payments & Checkout',
    stack: 'python-fastapi',
    repoUrl: 'github.com/systemwithayush/payment-processor',
    status: 'rolling_out',
    replicas: '1/2',
    env: 'staging',
    lastDeployed: 'Just now',
    cpuUsage: '220m / 400m',
    memUsage: '310Mi / 512Mi'
  },
  {
    id: 'srv-3',
    name: 'checkout-frontend',
    team: 'Payments & Checkout',
    stack: 'react-static',
    repoUrl: 'github.com/systemwithayush/checkout-web',
    status: 'succeeded',
    replicas: '3/3',
    env: 'prod',
    lastDeployed: '1h ago',
    cpuUsage: '45m / 200m',
    memUsage: '85Mi / 256Mi'
  },
  {
    id: 'srv-4',
    name: 'notification-worker',
    team: 'Platform Engineering',
    stack: 'node-express',
    repoUrl: 'github.com/systemwithayush/notify-svc',
    status: 'succeeded',
    replicas: '1/1',
    env: 'dev',
    lastDeployed: '2d ago',
    cpuUsage: '60m / 200m',
    memUsage: '120Mi / 256Mi'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'deployments' | 'advisory' | 'quotas' | 'audit'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStack, setSelectedStack] = useState<string>('all');
  const [services, setServices] = useState<ServiceItem[]>(INITIAL_SERVICES);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [targetService, setTargetService] = useState<string>('auth-gateway');
  const [targetEnv, setTargetEnv] = useState<'dev' | 'staging' | 'prod'>('staging');
  const [showSecrets, setShowSecrets] = useState(false);
  const [aiApproved, setAiApproved] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    '2026-11-04 09:30:12 [info] Pod scheduled to node kind-worker-2',
    '2026-11-04 09:30:13 [info] Pulling image ghcr.io/systemwithayush/auth-gateway:8f3c1a2',
    '2026-11-04 09:30:15 [info] Successfully pulled image in 1.84s',
    '2026-11-04 09:30:16 [info] Container started; mounted Secret idp-env-secret (AES-256 decrypted)',
    '2026-11-04 09:30:18 [ready] Express HTTP listener online at :3000',
    '2026-11-04 09:30:20 [healthz] GET /ready HTTP/1.1 200 OK (latency: 1.4ms)',
    '2026-11-04 09:30:22 [k8s] Readiness probe 3/3 passed; traffic routing enabled'
  ]);

  const filteredServices = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.team.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStack = selectedStack === 'all' || s.stack === selectedStack;
    return matchesSearch && matchesStack;
  });

  const handleTriggerDeploy = () => {
    setShowDeployModal(false);
    const newId = `srv-${Date.now()}`;
    setServices(prev => prev.map(s => s.name === targetService ? { ...s, status: 'rolling_out', env: targetEnv, lastDeployed: 'Just now' } : s));
    setLogs(prev => [
      ...prev,
      `2026-11-04 10:15:00 [idp] Triggered deployment dispatch on ${targetService} (${targetEnv})`,
      `2026-11-04 10:15:02 [ci] GitHub Actions run #189 status: building (correlation: ${newId})`,
      `2026-11-04 10:15:05 [registry] Image pushed to ghcr.io/systemwithayush/${targetService}:latest`
    ]);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-200 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <nav className="h-14 border-b border-slate-800/80 bg-[#0E131F]/90 backdrop-blur sticky top-0 z-50 px-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 font-bold tracking-tight text-white text-sm">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Terminal className="w-4 h-4" />
            </div>
            <span>IDP PLATFORM</span>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              v1.0-dev
            </span>
          </div>

          {/* Quick Breadcrumb */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 border-l border-slate-800 pl-6">
            <span className="text-slate-500">Org:</span>
            <span className="text-slate-200 font-medium">SystemWithAyush</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              kind-local (k8s v1.28)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button 
            onClick={() => setShowDeployModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg shadow-sm shadow-blue-600/30 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Deploy Service</span>
          </button>
          
          <div className="h-4 w-px bg-slate-800"></div>

          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1">
            <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-[10px] font-mono text-indigo-300 font-bold">
              A
            </div>
            <span className="text-slate-300 font-mono text-xs">admin1@idp.internal</span>
            <span className="bg-slate-800 text-slate-400 text-[10px] font-mono px-1.5 py-0.5 rounded">admin</span>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-60 border-r border-slate-800/80 bg-[#0B0F17] p-3 space-y-6">
          <div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 px-3 mb-2">
              Platform Modules
            </div>
            <nav className="space-y-1">
              {[
                { id: 'overview', name: 'Fleet Overview', icon: Activity },
                { id: 'services', name: 'Service Catalogue', icon: Layers, count: services.length },
                { id: 'deployments', name: 'Deployments & CI', icon: GitBranch, count: '38' },
                { id: 'advisory', name: 'AI Infrastructure', icon: Sparkles, badge: 'New' },
                { id: 'quotas', name: 'Resource Quotas', icon: Cpu },
                { id: 'audit', name: 'Audit Trail', icon: History },
              ].map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span>{item.name}</span>
                    </div>
                    {item.count && (
                      <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400">
                        {item.count}
                      </span>
                    )}
                    {item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-slate-800/80 pt-4 px-3">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Cluster Telemetry
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Memory Cap</span>
                <span className="font-mono text-slate-200">54%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: '54%' }}></div>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">17.6 / 32.7 GB Allocated</div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 max-w-7xl overflow-y-auto">
          {/* TAB 1: FLEET OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Engineering Fleet Overview</h1>
                  <p className="text-xs text-slate-400 mt-1">Real-time status across Kubernetes namespaces, environments, and automated CI/CD runs.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    WebSocket Connected
                  </span>
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-b from-[#131926] to-[#0E131F] border border-slate-800 p-4 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Active Services</span>
                    <Boxes className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-white mt-2 font-mono">{services.length}</div>
                  <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% healthy
                  </div>
                </div>

                <div className="bg-gradient-to-b from-[#131926] to-[#0E131F] border border-slate-800 p-4 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>24h Deployments</span>
                    <GitBranch className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-white mt-2 font-mono">38</div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">97.4% success rate</div>
                </div>

                <div className="bg-gradient-to-b from-[#131926] to-[#0E131F] border border-slate-800 p-4 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Mean Rollout Duration</span>
                    <Clock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-white mt-2 font-mono">4m 12s</div>
                  <div className="text-xs text-emerald-400 mt-1 font-mono">↓ 18s faster vs baseline</div>
                </div>

                <div className="bg-gradient-to-b from-[#131926] to-[#0E131F] border border-slate-800 p-4 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Platform Quota (mCPU)</span>
                    <Cpu className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-white mt-2 font-mono">54%</div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">8,600 / 16,000 mCPU</div>
                </div>
              </div>

              {/* Service Table */}
              <div className="bg-[#111622] border border-slate-800/90 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-white">Live Services</h2>
                    <span className="text-xs text-slate-400 font-mono">({filteredServices.length} registered)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Search services, teams..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-800/60 text-xs">
                  {filteredServices.map(service => (
                    <div key={service.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/20 transition-colors">
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-9 h-9 rounded-lg bg-slate-800/70 border border-slate-700/60 flex items-center justify-center font-mono font-bold text-blue-400">
                          {service.stack === 'node-express' ? 'JS' : service.stack === 'python-fastapi' ? 'PY' : 'TS'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{service.name}</span>
                            <span className="font-mono text-[11px] text-slate-400">{service.repoUrl}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400 text-xs mt-1">
                            <span>Team: <strong className="text-slate-300 font-normal">{service.team}</strong></span>
                            <span>•</span>
                            <span>CPU: <strong className="font-mono text-slate-300 font-normal">{service.cpuUsage}</strong></span>
                            <span>•</span>
                            <span>Replicas: <strong className="font-mono text-slate-300 font-normal">{service.replicas}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-1 rounded-full font-mono text-[11px] font-medium border ${
                          service.status === 'succeeded' 
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80' 
                            : 'bg-blue-950/80 text-blue-400 border-blue-800/80 animate-pulse'
                        }`}>
                          ● {service.status}
                        </span>

                        <span className={`font-mono text-xs px-2 py-0.5 rounded border ${
                          service.env === 'prod' 
                            ? 'bg-rose-950/40 text-rose-300 border-rose-900/60' 
                            : 'bg-indigo-950/40 text-indigo-300 border-indigo-900/60'
                        }`}>
                          {service.env}
                        </span>

                        <button 
                          onClick={() => {
                            setTargetService(service.name);
                            setShowDeployModal(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono transition-colors"
                        >
                          Deploy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real-time Streaming Logs Component */}
              <div className="bg-[#05070D] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="px-4 py-3 bg-[#0B0F17] border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-mono text-slate-200 font-semibold">Pod Log Stream (Kubernetes API follow=true)</span>
                    <span className="text-xs font-mono text-slate-500">room: deployment:auth-gateway-latest</span>
                  </div>
                  <button 
                    onClick={() => setLogs(prev => [...prev, `${new Date().toISOString()} [ping] Live socket heartbeat verified`])}
                    className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Ping Stream
                  </button>
                </div>
                <div className="p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-48 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={index} className="flex gap-2 leading-relaxed">
                      <span className="text-slate-600 select-none">[{index + 1}]</span>
                      <span className={log.includes('[ready]') ? 'text-emerald-400 font-medium' : log.includes('[k8s]') ? 'text-blue-400 font-medium' : 'text-slate-300'}>
                        {log}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SERVICE CATALOGUE */}
          {activeTab === 'services' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold text-white">Service Catalogue</h1>
                  <p className="text-xs text-slate-400 mt-1">Browse, inspect configuration, and manage environments for all team microservices.</p>
                </div>
                <div className="flex gap-2">
                  <select 
                    value={selectedStack}
                    onChange={e => setSelectedStack(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-xs text-white rounded-lg px-3 py-1.5 font-mono"
                  >
                    <option value="all">All Stacks</option>
                    <option value="node-express">Node.js Express</option>
                    <option value="python-fastapi">Python FastAPI</option>
                    <option value="react-static">React Static</option>
                  </select>
                </div>
              </div>

              {/* Secrets Reveal Demo */}
              <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    AES-256-GCM Encrypted Configuration Store
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Secrets are encrypted at rest with random IVs and masked by default. Reveal is audit-logged.
                  </div>
                </div>
                <button 
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg font-mono transition-colors"
                >
                  {showSecrets ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5 text-blue-400" />}
                  <span>{showSecrets ? 'Mask Secrets' : 'Reveal as Lead (Audit Logged)'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredServices.map(service => (
                  <div key={service.id} className="bg-[#111622] border border-slate-800 p-5 rounded-xl space-y-4 shadow-sm hover:border-slate-700 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-base">{service.name}</div>
                      <span className="text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                        {service.stack}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                      <div className="flex justify-between text-slate-400">
                        <span>DATABASE_URL:</span>
                        <span className="text-slate-300">{showSecrets ? 'mysql://prod_usr:9fK2#m8!@10.0.4.12:3306/db' : '••••••••••••••••••••••••••••••••'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>API_SECRET_KEY:</span>
                        <span className="text-slate-300">{showSecrets ? 'sk_live_94819402948102938471' : '••••••••••••••••••••••••••••••••'}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>PORT:</span>
                        <span className="text-emerald-400">3000</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400 font-mono">Namespace: idp-{service.name}-{service.env}</span>
                      <button 
                        onClick={() => {
                          setTargetService(service.name);
                          setShowDeployModal(true);
                        }}
                        className="text-blue-400 hover:text-blue-300 font-medium font-mono"
                      >
                        Rollout Update →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DEPLOYMENTS & STATE MACHINE */}
          {activeTab === 'deployments' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4">
                <h1 className="text-xl font-bold text-white">Deployment State Machine & History</h1>
                <p className="text-xs text-slate-400 mt-1">Every transition is enforced by a pure function and committed to deployment_events inside one DB transaction.</p>
              </div>

              {/* Visual State Pipeline */}
              <div className="bg-[#111622] border border-slate-800 p-5 rounded-xl space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Deterministic Transition Engine
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  {['requested', 'building', 'pushed', 'applying', 'rolling_out', 'succeeded'].map((step, idx) => (
                    <div key={step} className="flex items-center gap-2">
                      <span className={`px-3 py-1.5 rounded-lg border font-medium ${
                        step === 'succeeded' 
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' 
                          : step === 'rolling_out'
                          ? 'bg-blue-950/80 text-blue-400 border-blue-800 animate-pulse'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}>
                        {idx + 1}. {step}
                      </span>
                      {idx < 5 && <ArrowRight className="w-3.5 h-3.5 text-slate-600" />}
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800 font-mono">
                  ● Terminal States: <code className="text-emerald-400 font-bold">succeeded</code>, <code className="text-rose-400 font-bold">failed</code>, <code className="text-amber-400 font-bold">rolled_back</code>. Automated rollback occurs on failed readiness probes.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI INFRASTRUCTURE ADVISORY */}
          {activeTab === 'advisory' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  Grounded AI Infrastructure Recommendations
                </h1>
                <p className="text-xs text-slate-400 mt-1">Real-time pod resource usage telemetry analyzed via OpenAI Structured Outputs and quota boundaries.</p>
              </div>

              <div className="bg-[#111622] border border-slate-800 p-6 rounded-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Target Service: auth-gateway (Production)</h3>
                    <p className="text-xs text-slate-400">Input Metrics: 7-day P95 CPU: 120m, P95 Memory: 185MiB</p>
                  </div>
                  <span className={`font-mono text-xs px-2.5 py-1 rounded-full border ${
                    aiApproved ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}>
                    {aiApproved ? '● Approved & Applied' : 'Pending Lead Approval'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-slate-500 uppercase font-bold text-[10px]">Current Resource Requests</div>
                    <div className="flex justify-between text-slate-300"><span>CPU Request:</span><span>500m</span></div>
                    <div className="flex justify-between text-slate-300"><span>Memory Request:</span><span>512 MiB</span></div>
                    <div className="flex justify-between text-slate-300"><span>Replicas:</span><span>2</span></div>
                  </div>

                  <div className="bg-blue-950/20 p-4 rounded-xl border border-blue-500/30 space-y-2">
                    <div className="text-blue-400 uppercase font-bold text-[10px]">AI Advisory (Confidence: 0.94)</div>
                    <div className="flex justify-between text-emerald-400 font-semibold"><span>Recommended CPU:</span><span>250m (-50% cost)</span></div>
                    <div className="flex justify-between text-emerald-400 font-semibold"><span>Recommended Mem:</span><span>256 MiB (-50%)</span></div>
                    <div className="flex justify-between text-blue-300 font-semibold"><span>Recommended Replicas:</span><span>2</span></div>
                  </div>
                </div>

                <div className="text-xs text-slate-300 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <strong className="text-white">Model Reasoning:</strong>
                  <ul className="list-disc list-inside text-slate-400 space-y-0.5 text-xs">
                    <li>P95 CPU utilization over 7 days never exceeded 140m across all replicas.</li>
                    <li>Halving CPU and Memory request safely preserves 1.8x headroom while freeing 250m team quota.</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    disabled={aiApproved}
                    onClick={() => setAiApproved(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow transition-all disabled:opacity-50"
                  >
                    {aiApproved ? 'Changes Staged to Manifests' : 'Approve & Apply to Next Deploy'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5 & 6: QUOTAS & AUDIT */}
          {(activeTab === 'quotas' || activeTab === 'audit') && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4">
                <h1 className="text-xl font-bold text-white">
                  {activeTab === 'quotas' ? 'Team Resource Quotas' : 'Immutable Audit Log'}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {activeTab === 'quotas' ? 'Enforced in service creation and environment resizing.' : 'Every mutating endpoint records user, action, and JSON metadata.'}
                </p>
              </div>

              <div className="bg-[#111622] border border-slate-800 rounded-xl p-4 divide-y divide-slate-800/80 text-xs font-mono">
                {[
                  { time: '10:12:44', user: 'admin1@idp.internal', action: 'DEPLOY_SERVICE', entity: 'auth-gateway', status: 'SUCCESS' },
                  { time: '09:58:12', user: 'lead.platform@idp.internal', action: 'REVEAL_SECRET', entity: 'auth-gateway-env', status: 'AUDITED' },
                  { time: '09:30:00', user: 'dev.alice@idp.internal', action: 'CREATE_ENVIRONMENT', entity: 'auth-gateway:staging', status: 'SUCCESS' },
                ].map((log, i) => (
                  <div key={i} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{log.time}</span>
                      <span className="text-slate-200">{log.user}</span>
                      <span className="text-blue-400 font-bold">{log.action}</span>
                      <span className="text-slate-400">{log.entity}</span>
                    </div>
                    <span className="text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/80 text-[10px]">
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Deployment Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111622] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-500" />
                Trigger Microservice Rollout
              </h3>
              <button onClick={() => setShowDeployModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Target Service</label>
                <select 
                  value={targetService}
                  onChange={e => setTargetService(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white"
                >
                  {services.map(s => <option key={s.id} value={s.name}>{s.name} ({s.stack})</option>)}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Environment</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dev', 'staging', 'prod'] as const).map(env => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setTargetEnv(env)}
                      className={`p-2 rounded-lg border font-bold text-center ${
                        targetEnv === env ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {env}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-400 space-y-1">
                <div>Git Commit: <strong className="text-slate-200">main (HEAD)</strong></div>
                <div>Trigger Method: <strong className="text-blue-400">workflow_dispatch with correlation_id</strong></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowDeployModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono"
              >
                Cancel
              </button>
              <button 
                onClick={handleTriggerDeploy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold font-mono shadow-lg shadow-blue-600/30"
              >
                Execute Rollout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
