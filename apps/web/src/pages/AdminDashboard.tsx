import { useState, useEffect, useCallback } from 'react';
import DashboardLayout, { NavItem } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import {
  Layers, Activity, GitBranch, ShieldCheck, History, Users, KeyRound,
  Sparkles, FileCode, Eye, EyeOff, Copy, Check, AlertTriangle,
  CheckCircle2, RefreshCw, Download, Plus, Search, Boxes,
  Trash2, Terminal
} from 'lucide-react';

const API = 'http://localhost:4000/api/v1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiRecord = Record<string, any>;

const NAV_ITEMS: NavItem[] = [
  { id: 'overview',   label: 'Fleet Overview',  icon: <Activity className="w-4 h-4" /> },
  { id: 'services',   label: 'All Services',     icon: <Layers className="w-4 h-4" /> },
  { id: 'deployments',label: 'Deployments',      icon: <GitBranch className="w-4 h-4" /> },
  { id: 'terraform',  label: 'Terraform HCL',    icon: <FileCode className="w-4 h-4" /> },
  { id: 'ai',         label: 'AI Advisory',      icon: <Sparkles className="w-4 h-4" /> },
  { id: 'quotas',     label: 'All Quotas',       icon: <Boxes className="w-4 h-4" /> },
  { id: 'secrets',    label: 'Secrets Vault',    icon: <KeyRound className="w-4 h-4" /> },
  { id: 'audit',      label: 'Full Audit Trail', icon: <History className="w-4 h-4" /> },
  { id: 'users',      label: 'User Management',  icon: <Users className="w-4 h-4" /> },
];

function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    slate:   'bg-slate-800 text-slate-400 border-slate-700',
    blue:    'bg-blue-900/40 text-blue-400 border-blue-700/60',
    green:   'bg-emerald-900/40 text-emerald-400 border-emerald-700/60',
    red:     'bg-red-900/40 text-red-400 border-red-700/60',
    purple:  'bg-purple-900/40 text-purple-400 border-purple-700/60',
    yellow:  'bg-yellow-900/40 text-yellow-400 border-yellow-700/60',
    cyan:    'bg-cyan-900/40 text-cyan-400 border-cyan-700/60',
  };
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${map[color] ?? map.slate}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue:   'text-blue-400 border-blue-900/50',
    purple: 'text-purple-400 border-purple-900/50',
    emerald:'text-emerald-400 border-emerald-900/50',
    amber:  'text-amber-400 border-amber-900/50',
  };
  return (
    <div className={`bg-[#0d1424] border ${colors[color] ?? colors.blue} rounded-lg p-4`}>
      <div className="text-slate-500 text-xs font-mono uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-mono font-bold ${colors[color]?.split(' ')[0]}`}>{value}</div>
      {sub && <div className="text-slate-600 text-[11px] font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-slate-200 font-mono font-semibold text-sm">{title}</h2>
      {sub && <p className="text-slate-600 text-xs font-mono mt-0.5">{sub}</p>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="text-slate-600 hover:text-slate-300 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
function Overview({ token }: { token: string }) {
  const [services, setServices] = useState<unknown[]>([]);
  const [deployments, setDeployments] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/services`, { headers }).then(r => r.ok ? r.json() : { data: [] }),
      fetch(`${API}/deployments?limit=5`, { headers }).then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([svc, dep]) => {
      setServices((svc as { data: unknown[] }).data ?? svc);
      setDeployments((dep as { data: unknown[] }).data ?? dep);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <SectionHeader title="Fleet Overview" sub="Real-time platform health · all teams" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Services" value={Array.isArray(services) ? services.length : 0} sub="across all teams" color="blue" />
        <StatCard label="Deployments Today" value={Array.isArray(deployments) ? deployments.length : 0} sub="last 24h" color="purple" />
        <StatCard label="Teams" value={3} sub="active" color="emerald" />
        <StatCard label="Uptime" value="99.8%" sub="30-day avg" color="amber" />
      </div>

      <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400 text-xs font-mono font-semibold">Recent Deployments</span>
        </div>
        {Array.isArray(deployments) && deployments.length > 0 ? (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-slate-600 px-4 py-2 font-normal">Service</th>
                <th className="text-left text-slate-600 px-4 py-2 font-normal">Env</th>
                <th className="text-left text-slate-600 px-4 py-2 font-normal">Status</th>
                <th className="text-left text-slate-600 px-4 py-2 font-normal">Time</th>
              </tr>
            </thead>
            <tbody>
              {(deployments as ApiRecord[]).map((d, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-300">{d.service?.name ?? d.serviceId ?? '—'}</td>
                  <td className="px-4 py-2"><Badge color="cyan">{d.environment ?? '—'}</Badge></td>
                  <td className="px-4 py-2">
                    <Badge color={d.status === 'running' ? 'green' : d.status === 'failed' ? 'red' : 'yellow'}>
                      {d.status ?? '—'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{d.createdAt ? new Date(d.createdAt).toLocaleTimeString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-6 text-slate-700 text-xs font-mono text-center">No recent deployments · deploy a service to see activity</div>
        )}
      </div>
    </div>
  );
}

// ─── SERVICES ─────────────────────────────────────────────────────────────────
function AllServices({ token }: { token: string }) {
  const [services, setServices] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', language: 'nodejs', framework: 'express', teamId: '' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setServices(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = services.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Service name is required'); return; }
    setError(null);
    try {
      const res = await fetch(`${API}/services`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.message || 'Failed'); }
      setAdding(false);
      setForm({ name: '', language: 'nodejs', framework: 'express', teamId: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
    }
  };

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="All Services" sub="Complete service catalogue across all teams" />
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services…"
            className="w-full bg-[#0d1424] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-mono rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Service
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="bg-[#0d1424] border border-blue-800/50 rounded-lg p-4 space-y-3">
          <div className="text-slate-300 text-xs font-mono font-semibold mb-1">Create Service</div>
          {error && <div className="text-red-400 text-xs font-mono">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="service-name" className="col-span-2 bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-blue-500" />
            <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="nodejs">Node.js</option>
              <option value="python">Python</option>
              <option value="go">Go</option>
              <option value="java">Java</option>
            </select>
            <select value={form.framework} onChange={e => setForm(f => ({ ...f, framework: e.target.value }))} className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="express">Express</option>
              <option value="fastapi">FastAPI</option>
              <option value="gin">Gin</option>
              <option value="spring">Spring</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-xs font-mono bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">Create</button>
          </div>
        </form>
      )}

      <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-slate-700 text-xs font-mono text-center">No services found</div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Name</th>
                <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Language</th>
                <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Framework</th>
                <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Status</th>
                <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2.5 text-slate-200 font-semibold">{s.name}</td>
                  <td className="px-4 py-2.5"><Badge color="cyan">{s.language}</Badge></td>
                  <td className="px-4 py-2.5 text-slate-400">{s.framework}</td>
                  <td className="px-4 py-2.5"><Badge color="green">{s.status ?? 'active'}</Badge></td>
                  <td className="px-4 py-2.5 text-slate-600">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── DEPLOYMENTS ──────────────────────────────────────────────────────────────
function Deployments({ token }: { token: string }) {
  const [deployments, setDeployments] = useState<ApiRecord[]>([]);
  const [services, setServices] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [form, setForm] = useState({ serviceId: '', environment: 'dev', imageTag: 'latest' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/deployments`, { headers: h }).then(r => r.json()),
      fetch(`${API}/services`, { headers: h }).then(r => r.json()),
    ]).then(([d, s]) => {
      setDeployments(d.data ?? d);
      setServices(s.data ?? s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const deploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serviceId) { setMsg('Select a service'); return; }
    setDeploying(true); setMsg(null);
    try {
      const res = await fetch(`${API}/deployments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.message || 'Deploy failed');
      setMsg('✓ Deployment queued successfully');
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setDeploying(false);
    }
  };

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="Deployments" sub="Admin can deploy to any environment including production" />

      <form onSubmit={deploy} className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="text-slate-300 text-xs font-mono font-semibold">Trigger Deployment</div>
        {msg && <div className={`text-xs font-mono ${msg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</div>}
        <div className="grid grid-cols-3 gap-3">
          <select value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))} className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
            <option value="">Select service…</option>
            {Array.isArray(services) && services.map((s, i) => <option key={i} value={s.id}>{s.name}</option>)}
          </select>
          <select value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))} className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
          <input value={form.imageTag} onChange={e => setForm(f => ({ ...f, imageTag: e.target.value }))} placeholder="Image tag" className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-blue-500" />
        </div>
        <button disabled={deploying} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-mono rounded-lg transition-colors">
          {deploying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
          {deploying ? 'Deploying…' : 'Deploy'}
        </button>
      </form>

      <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 text-slate-400 text-xs font-mono font-semibold">History</div>
        {Array.isArray(deployments) && deployments.length > 0 ? (
          <table className="w-full text-xs font-mono">
            <thead><tr className="border-b border-slate-800">
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Service</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Env</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Tag</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Status</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Time</th>
            </tr></thead>
            <tbody>
              {deployments.map((d, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-300">{d.service?.name ?? d.serviceId ?? '—'}</td>
                  <td className="px-4 py-2"><Badge color={d.environment === 'production' ? 'red' : d.environment === 'staging' ? 'yellow' : 'cyan'}>{d.environment ?? '—'}</Badge></td>
                  <td className="px-4 py-2 text-slate-500">{d.imageTag ?? '—'}</td>
                  <td className="px-4 py-2"><Badge color={d.status === 'running' ? 'green' : d.status === 'failed' ? 'red' : 'yellow'}>{d.status ?? '—'}</Badge></td>
                  <td className="px-4 py-2 text-slate-600">{d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-6 text-slate-700 text-xs font-mono text-center">No deployments yet</div>
        )}
      </div>
    </div>
  );
}

// ─── TERRAFORM HCL ────────────────────────────────────────────────────────────
function TerraformHCL({ token }: { token: string }) {
  const [services, setServices] = useState<ApiRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [hcl, setHcl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setServices(d.data ?? d)).catch(() => {});
  }, [token]);

  const generate = async () => {
    if (!selectedId) return;
    setGenerating(true); setHcl('');
    try {
      const res = await fetch(`${API}/terraform/${selectedId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed');
      const d = await res.json() as { hcl?: string };
      setHcl(d.hcl ?? JSON.stringify(d, null, 2));
    } catch {
      setHcl('# Error generating Terraform HCL. Ensure the service exists and API is running.');
    } finally {
      setGenerating(false);
    }
  };

  const copy = () => { navigator.clipboard.writeText(hcl); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([hcl], { type: 'text/plain' }));
    a.download = 'main.tf'; a.click();
  };

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="Terraform HCL Generator" sub="Generate infrastructure-as-code for any service" />
      <div className="flex gap-3">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="flex-1 bg-[#0d1424] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
          <option value="">Select service…</option>
          {services.map((s, i) => <option key={i} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={generate} disabled={!selectedId || generating} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-mono rounded-lg transition-colors">
          {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5" />}
          {generating ? 'Generating…' : 'Generate HCL'}
        </button>
      </div>

      {hcl && (
        <div className="bg-[#060a12] border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-400 text-xs font-mono font-semibold flex-1">main.tf</span>
            <button onClick={copy} className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs font-mono transition-colors">
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={download} className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs font-mono transition-colors ml-2">
              <Download className="w-3 h-3" /> Download
            </button>
          </div>
          <pre className="p-4 text-xs font-mono text-emerald-300/80 overflow-x-auto whitespace-pre custom-scrollbar max-h-[60vh]">{hcl}</pre>
        </div>
      )}
    </div>
  );
}

// ─── AI ADVISORY ──────────────────────────────────────────────────────────────
function AIAdvisory({ token }: { token: string }) {
  const [items, setItems] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`${API}/ai-advisory`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setItems(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActing(id); setMsg(null);
    try {
      const res = await fetch(`${API}/ai-advisory/${id}/${action}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: `${action}d by admin` }),
      });
      if (!res.ok) throw new Error('Action failed');
      setMsg(`✓ Advisory ${action}d`);
      load();
    } catch { setMsg('Action failed'); } finally { setActing(null); }
  };

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="AI Advisory" sub="Approve or reject AI-generated infrastructure recommendations" />
      {msg && <div className={`text-xs font-mono px-3 py-2 rounded border ${msg.startsWith('✓') ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800' : 'text-red-400 bg-red-900/20 border-red-800'}`}>{msg}</div>}
      {Array.isArray(items) && items.length > 0 ? items.map((item, i) => (
        <div key={i} className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-slate-200 text-sm font-mono font-semibold">{item.service?.name ?? item.serviceId ?? 'Service'}</span>
            <Badge color={item.status === 'pending' ? 'yellow' : item.status === 'approved' ? 'green' : 'red'}>{item.status ?? 'pending'}</Badge>
          </div>
          <p className="text-slate-400 text-xs font-mono">{item.recommendation ?? item.summary ?? 'AI-generated recommendation'}</p>
          {item.status === 'pending' && (
            <div className="flex gap-2">
              <button onClick={() => act(item.id, 'approve')} disabled={acting === item.id} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-700/50 text-emerald-300 text-xs font-mono rounded transition-colors">
                <CheckCircle2 className="w-3 h-3" /> Approve
              </button>
              <button onClick={() => act(item.id, 'reject')} disabled={acting === item.id} className="flex items-center gap-1 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 text-red-400 text-xs font-mono rounded transition-colors">
                <AlertTriangle className="w-3 h-3" /> Reject
              </button>
            </div>
          )}
        </div>
      )) : (
        <div className="bg-[#0d1424] border border-slate-800 rounded-lg px-4 py-8 text-slate-700 text-xs font-mono text-center">No pending AI advisories</div>
      )}
    </div>
  );
}

// ─── QUOTAS ───────────────────────────────────────────────────────────────────
function Quotas({ token }: { token: string }) {
  const [quotas, setQuotas] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/quotas`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setQuotas(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="All Quotas" sub="Resource quota management across all teams" />
      {Array.isArray(quotas) && quotas.length > 0 ? quotas.map((q, i) => {
        const pct = q.maxServices ? Math.round((q.usedServices ?? 0) / q.maxServices * 100) : 0;
        return (
          <div key={i} className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 text-sm font-mono font-semibold">{q.team?.name ?? q.teamId ?? `Team ${i + 1}`}</span>
              <Badge color={pct > 80 ? 'red' : pct > 60 ? 'yellow' : 'green'}>{pct}% used</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div><div className="text-slate-600 mb-0.5">Services</div><div className="text-slate-300">{q.usedServices ?? 0} / {q.maxServices ?? '∞'}</div></div>
              <div><div className="text-slate-600 mb-0.5">CPU (cores)</div><div className="text-slate-300">{q.usedCpu ?? 0} / {q.maxCpu ?? '∞'}</div></div>
              <div><div className="text-slate-600 mb-0.5">Memory (GB)</div><div className="text-slate-300">{q.usedMemory ?? 0} / {q.maxMemory ?? '∞'}</div></div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        );
      }) : (
        <div className="bg-[#0d1424] border border-slate-800 rounded-lg px-4 py-8 text-slate-700 text-xs font-mono text-center">No quota data available · ensure database is seeded</div>
      )}
    </div>
  );
}

// ─── SECRETS VAULT ────────────────────────────────────────────────────────────
function SecretsVault({ token }: { token: string }) {
  const [services, setServices] = useState<ApiRecord[]>([]);
  const [selectedSvcId, setSelectedSvcId] = useState('');
  const [envs, setEnvs] = useState<ApiRecord[]>([]);
  const [secrets, setSecrets] = useState<Record<string, string | boolean>[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [addingSecret, setAddingSecret] = useState(false);
  const [newSecret, setNewSecret] = useState({ key: '', value: '' });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setServices(d.data ?? d)).catch(() => {});
  }, [token]);

  const loadEnvs = (svcId: string) => {
    setSelectedSvcId(svcId); setSelectedEnvId(''); setSecrets([]);
    if (!svcId) return;
    fetch(`${API}/services/${svcId}/environments`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setEnvs(d.data ?? d)).catch(() => {});
  };

  const loadSecrets = (envId: string) => {
    setSelectedEnvId(envId); setSecrets([]); setLoading(true); setRevealed({});
    if (!envId) { setLoading(false); return; }
    fetch(`${API}/environments/${envId}/secrets`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setSecrets(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const addSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecret.key || !newSecret.value || !selectedEnvId) return;
    try {
      const res = await fetch(`${API}/environments/${selectedEnvId}/secrets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newSecret),
      });
      if (!res.ok) throw new Error('Failed');
      setAddingSecret(false); setNewSecret({ key: '', value: '' });
      setMsg('✓ Secret added'); loadSecrets(selectedEnvId);
    } catch { setMsg('Failed to add secret'); }
  };

  const deleteSecret = async (id: string) => {
    try {
      await fetch(`${API}/secrets/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setMsg('✓ Secret deleted'); loadSecrets(selectedEnvId);
    } catch { setMsg('Delete failed'); }
  };

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="Secrets Vault" sub="Admin full access — all secrets across all environments" />
      {msg && <div className={`text-xs font-mono px-3 py-2 rounded border ${msg.startsWith('✓') ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800' : 'text-red-400 bg-red-900/20 border-red-800'}`}>{msg}</div>}

      <div className="flex gap-3">
        <select value={selectedSvcId} onChange={e => loadEnvs(e.target.value)} className="flex-1 bg-[#0d1424] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
          <option value="">Select service…</option>
          {Array.isArray(services) && services.map((s, i) => <option key={i} value={s.id}>{s.name}</option>)}
        </select>
        <select value={selectedEnvId} onChange={e => loadSecrets(e.target.value)} disabled={!selectedSvcId} className="flex-1 bg-[#0d1424] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500 disabled:opacity-40">
          <option value="">Select environment…</option>
          {Array.isArray(envs) && envs.map((e, i) => <option key={i} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {selectedEnvId && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setAddingSecret(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono rounded transition-colors">
              <Plus className="w-3 h-3" /> Add Secret
            </button>
          </div>
          {addingSecret && (
            <form onSubmit={addSecret} className="bg-[#0d1424] border border-blue-800/50 rounded-lg p-3 flex gap-2">
              <input value={newSecret.key} onChange={e => setNewSecret(s => ({ ...s, key: e.target.value }))} placeholder="KEY" className="flex-1 bg-[#090d16] border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-blue-500" />
              <input value={newSecret.value} onChange={e => setNewSecret(s => ({ ...s, value: e.target.value }))} placeholder="value" type="password" className="flex-1 bg-[#090d16] border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-blue-500" />
              <button type="submit" className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-mono rounded transition-colors">Save</button>
              <button type="button" onClick={() => setAddingSecret(false)} className="px-2 py-1.5 text-slate-500 hover:text-slate-300 text-xs font-mono transition-colors">✕</button>
            </form>
          )}
        </>
      )}

      <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-4 py-6 text-slate-600 text-xs font-mono text-center">Loading secrets…</div>
        ) : !selectedEnvId ? (
          <div className="px-4 py-6 text-slate-700 text-xs font-mono text-center">Select a service and environment</div>
        ) : Array.isArray(secrets) && secrets.length > 0 ? (
          <table className="w-full text-xs font-mono">
            <thead><tr className="border-b border-slate-800">
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Key</th>
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Value</th>
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Actions</th>
            </tr></thead>
            <tbody>
              {secrets.map((s, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2.5 text-slate-300 font-semibold">{s.key as string}</td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {revealed[s.id as string] ? (
                      <span className="text-emerald-400">{s.value as string}</span>
                    ) : (
                      <span className="tracking-widest text-slate-700">••••••••</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setRevealed(r => ({ ...r, [s.id as string]: !r[s.id as string] }))} className="text-slate-600 hover:text-slate-300 transition-colors">
                        {revealed[s.id as string] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <CopyButton text={s.value as string} />
                      <button onClick={() => deleteSecret(s.id as string)} className="text-slate-700 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-6 text-slate-700 text-xs font-mono text-center">No secrets in this environment</div>
        )}
      </div>
    </div>
  );
}

// ─── AUDIT TRAIL ──────────────────────────────────────────────────────────────
function AuditTrail({ token }: { token: string }) {
  const [logs, setLogs] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/audit`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setLogs(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="Full Audit Trail" sub="Immutable log of all actions across the platform" />
      <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden">
        {Array.isArray(logs) && logs.length > 0 ? (
          <table className="w-full text-xs font-mono">
            <thead><tr className="border-b border-slate-800">
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Time</th>
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Actor</th>
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Action</th>
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Resource</th>
            </tr></thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 text-slate-400">{l.user?.email ?? l.userId ?? '—'}</td>
                  <td className="px-4 py-2"><Badge color="blue">{l.action ?? '—'}</Badge></td>
                  <td className="px-4 py-2 text-slate-500 truncate max-w-[200px]">{l.resource ?? l.resourceId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-8 text-slate-700 text-xs font-mono text-center">No audit entries yet · actions will appear here</div>
        )}
      </div>
    </div>
  );
}

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────
function UserManagement({ token }: { token: string }) {
  const USERS = [
    { name: 'Divya', email: 'divya@idp.internal', role: 'admin', team: 'Platform', avatar: 'DV', avatarBg: 'bg-gradient-to-br from-purple-600 to-indigo-700', badge: { label: 'ADMIN', cls: 'text-purple-400 bg-purple-900/40 border-purple-700/50' } },
    { name: 'Deepak', email: 'deepak@idp.internal', role: 'lead', team: 'Payments & Core', avatar: 'DK', avatarBg: 'bg-gradient-to-br from-blue-600 to-cyan-700', badge: { label: 'LEAD', cls: 'text-blue-400 bg-blue-900/40 border-blue-700/50' } },
    { name: 'Ayush', email: 'ayush@idp.internal', role: 'developer', team: 'Payments & Core', avatar: 'AY', avatarBg: 'bg-gradient-to-br from-emerald-600 to-teal-700', badge: { label: 'DEV', cls: 'text-emerald-400 bg-emerald-900/40 border-emerald-700/50' } },
  ];
  // Suppress unused token lint
  void token;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="User Management" sub="Platform users and their RBAC roles" />
      <div className="space-y-3">
        {USERS.map((u, i) => (
          <div key={i} className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg ${u.avatarBg} flex items-center justify-center text-white text-sm font-bold font-mono shrink-0`}>
              {u.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-slate-200 text-sm font-mono font-semibold">{u.name}</div>
              <div className="text-slate-500 text-xs font-mono">{u.email}</div>
            </div>
            <div className="text-slate-500 text-xs font-mono hidden md:block">{u.team}</div>
            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${u.badge.cls}`}>{u.badge.label}</span>
            <div className="flex items-center gap-1 text-emerald-500 text-xs font-mono">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[#0d1424] border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          <span>RBAC is enforced API-side via JWT claims. Role changes require a database update and re-login.</span>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    if (!token) return null;
    switch (activeTab) {
      case 'overview':    return <Overview token={token} />;
      case 'services':    return <AllServices token={token} />;
      case 'deployments': return <Deployments token={token} />;
      case 'terraform':   return <TerraformHCL token={token} />;
      case 'ai':          return <AIAdvisory token={token} />;
      case 'quotas':      return <Quotas token={token} />;
      case 'secrets':     return <SecretsVault token={token} />;
      case 'audit':       return <AuditTrail token={token} />;
      case 'users':       return <UserManagement token={token} />;
      default:            return <Overview token={token} />;
    }
  };

  return (
    <DashboardLayout
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerRight={
        <div className="flex items-center gap-1.5 text-purple-400 text-xs font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Admin Access</span>
        </div>
      }
    >
      {renderContent()}
    </DashboardLayout>
  );
}
