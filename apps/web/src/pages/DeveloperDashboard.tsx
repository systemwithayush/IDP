import { useState, useEffect, useCallback } from 'react';
import DashboardLayout, { NavItem } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import {
  Layers, GitBranch, FileCode, History, Terminal, Plus, RefreshCw,
  Download, Copy, Check, Lock, Sparkles, Activity, AlertTriangle,
  CheckCircle2, Server, ChevronRight, X
} from 'lucide-react';

const API = 'http://localhost:4000/api/v1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiRecord = Record<string, any>;

const NAV_ITEMS: NavItem[] = [
  { id: 'services',    label: 'My Services',      icon: <Layers className="w-4 h-4" /> },
  { id: 'scaffold',    label: 'Scaffold Service',  icon: <Plus className="w-4 h-4" /> },
  { id: 'deployments', label: 'Deployments',      icon: <GitBranch className="w-4 h-4" /> },
  { id: 'terraform',   label: 'Terraform HCL',    icon: <FileCode className="w-4 h-4" /> },
  { id: 'ai',          label: 'AI Advisory',      icon: <Sparkles className="w-4 h-4" /> },
  { id: 'audit',       label: 'My Audit Trail',   icon: <History className="w-4 h-4" /> },
];

function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-800 text-slate-400 border-slate-700',
    blue: 'bg-blue-900/40 text-blue-400 border-blue-700/60',
    green: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/60',
    red: 'bg-red-900/40 text-red-400 border-red-700/60',
    yellow: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/60',
    cyan: 'bg-cyan-900/40 text-cyan-400 border-cyan-700/60',
    purple: 'bg-purple-900/40 text-purple-400 border-purple-700/60',
  };
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${map[color] ?? map.slate}`}>
      {children}
    </span>
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

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/20 border border-blue-800/50 rounded-lg text-blue-400 text-xs font-mono">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      {children}
    </div>
  );
}

// ─── MY SERVICES ──────────────────────────────────────────────────────────────
function MyServices({ token }: { token: string }) {
  const [services, setServices] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setServices(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="My Services" sub="Services you own · dev & staging access only" />
      <InfoBanner>Production access requires approval from your Team Lead (Deepak)</InfoBanner>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.isArray(services) && services.length > 0 ? services.map((s, i) => (
          <div key={i} className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-200 text-sm font-mono font-semibold flex-1 truncate">{s.name}</span>
              <Badge color="green">{s.status ?? 'active'}</Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color="cyan">{s.language}</Badge>
              <Badge color="slate">{s.framework}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="flex items-center gap-1 text-slate-500">
                <Activity className="w-3 h-3" />
                <span>dev · staging</span>
              </div>
              <div className="flex items-center gap-1 text-slate-700 ml-auto">
                <Lock className="w-3 h-3" />
                <span>prod locked</span>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-2 bg-[#0d1424] border border-slate-800 rounded-lg px-4 py-8 text-slate-700 text-xs font-mono text-center">
            No services yet · scaffold a new service to get started
          </div>
        )}
      </div>

      {/* Quota bar — read-only */}
      <div className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">Team quota usage</span>
          <span className="text-slate-400">{Array.isArray(services) ? services.length : 0} / 10 services</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(((Array.isArray(services) ? services.length : 0) / 10) * 100, 100)}%` }} />
        </div>
        <p className="text-slate-700 text-[11px] font-mono">Read-only · contact Deepak to request quota increase</p>
      </div>
    </div>
  );
}

// ─── SCAFFOLD SERVICE ─────────────────────────────────────────────────────────
function ScaffoldService({ token }: { token: string }) {
  const [form, setForm] = useState({
    name: '',
    language: 'nodejs',
    framework: 'express',
    description: '',
    includeDockerfile: true,
    includeCICD: true,
    includeHelm: false,
  });
  const [scaffolding, setScaffolding] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; files?: string[] } | null>(null);

  const scaffold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setScaffolding(true); setResult(null);
    try {
      const res = await fetch(`${API}/scaffold`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const b = await res.json() as { message?: string; files?: string[] };
      if (!res.ok) throw new Error(b.message || 'Scaffold failed');
      setResult({ success: true, message: b.message ?? 'Service scaffolded successfully', files: b.files ?? [] });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Scaffold failed' });
    } finally {
      setScaffolding(false);
    }
  };

  const LANGS = ['nodejs', 'python', 'go', 'java', 'rust'];
  const FRAMEWORKS: Record<string, string[]> = {
    nodejs: ['express', 'fastify', 'nest'],
    python: ['fastapi', 'flask', 'django'],
    go: ['gin', 'echo', 'fiber'],
    java: ['spring', 'quarkus', 'micronaut'],
    rust: ['axum', 'actix'],
  };

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="Scaffold New Service" sub="Golden path — creates repo structure, CI/CD, Dockerfile, Helm chart" />

      <form onSubmit={scaffold} className="bg-[#0d1424] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-slate-500 text-xs font-mono uppercase tracking-wider block mb-1.5">Service Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
              placeholder="my-service"
              className="w-full bg-[#090d16] border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-500 text-xs font-mono uppercase tracking-wider block mb-1.5">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What does this service do?"
              className="w-full bg-[#090d16] border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-slate-500 text-xs font-mono uppercase tracking-wider block mb-1.5">Language</label>
            <select
              value={form.language}
              onChange={e => setForm(f => ({ ...f, language: e.target.value, framework: FRAMEWORKS[e.target.value]?.[0] ?? 'express' }))}
              className="w-full bg-[#090d16] border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500"
            >
              {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-500 text-xs font-mono uppercase tracking-wider block mb-1.5">Framework</label>
            <select
              value={form.framework}
              onChange={e => setForm(f => ({ ...f, framework: e.target.value }))}
              className="w-full bg-[#090d16] border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500"
            >
              {(FRAMEWORKS[form.language] ?? ['express']).map(fw => <option key={fw} value={fw}>{fw}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {[
            { key: 'includeDockerfile' as const, label: 'Include Dockerfile' },
            { key: 'includeCICD' as const, label: 'Include CI/CD Pipeline' },
            { key: 'includeHelm' as const, label: 'Include Helm Chart' },
          ].map(opt => (
            <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, [opt.key]: !f[opt.key] }))}
                className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${form[opt.key] ? 'bg-blue-600' : 'bg-slate-700'}`}
              >
                <div className={`w-3 h-3 rounded-full bg-white transition-transform mt-0.5 mx-0.5 ${form[opt.key] ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-slate-400 text-xs font-mono">{opt.label}</span>
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={scaffolding || !form.name.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-mono font-semibold rounded-lg transition-colors"
        >
          {scaffolding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {scaffolding ? 'Scaffolding…' : 'Scaffold Service'}
        </button>
      </form>

      {result && (
        <div className={`rounded-lg border p-4 space-y-2 ${result.success ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-red-900/20 border-red-800/50'}`}>
          <div className={`flex items-center gap-2 text-sm font-mono font-semibold ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
            {result.success ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {result.message}
          </div>
          {result.files && result.files.length > 0 && (
            <div className="space-y-1">
              <div className="text-slate-600 text-xs font-mono">Generated files:</div>
              {result.files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                  <FileCode className="w-3 h-3 text-slate-600" />
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DEPLOYMENTS ──────────────────────────────────────────────────────────────
function Deployments({ token }: { token: string }) {
  const [services, setServices] = useState<ApiRecord[]>([]);
  const [deployments, setDeployments] = useState<ApiRecord[]>([]);
  const [form, setForm] = useState({ serviceId: '', environment: 'dev', imageTag: 'latest' });
  const [deploying, setDeploying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/services`, { headers: h }).then(r => r.json()),
      fetch(`${API}/deployments`, { headers: h }).then(r => r.json()),
    ]).then(([s, d]) => {
      setServices(s.data ?? s); setDeployments(d.data ?? d); setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const deploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serviceId) { setMsg('Select a service'); return; }
    if (form.environment === 'production') { setMsg('⛔ Production deploys require approval from Team Lead'); return; }
    setDeploying(true); setMsg(null);
    try {
      const res = await fetch(`${API}/deployments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.message || 'Deploy failed');
      setMsg('✓ Deployment queued'); load();
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Error'); }
    finally { setDeploying(false); }
  };

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="Deployments" sub="Deploy to dev or staging · production requires lead approval" />
      <InfoBanner>You can deploy to dev and staging · production is restricted to Team Lead</InfoBanner>

      <form onSubmit={deploy} className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="text-slate-300 text-xs font-mono font-semibold">Trigger Deployment</div>
        {msg && (
          <div className={`text-xs font-mono px-2 py-1.5 rounded ${msg.startsWith('✓') ? 'text-emerald-400 bg-emerald-900/20 border border-emerald-800/50' : 'text-red-400 bg-red-900/20 border border-red-800/50'}`}>
            {msg}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <select value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))} className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
            <option value="">Select service…</option>
            {Array.isArray(services) && services.map((s, i) => <option key={i} value={s.id}>{s.name}</option>)}
          </select>
          <select value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))} className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="production" disabled>production (lead only)</option>
          </select>
          <input value={form.imageTag} onChange={e => setForm(f => ({ ...f, imageTag: e.target.value }))} placeholder="Image tag" className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-blue-500" />
        </div>
        <button disabled={deploying} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-mono rounded-lg transition-colors">
          {deploying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
          {deploying ? 'Deploying…' : 'Deploy'}
        </button>
      </form>

      <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 text-slate-400 text-xs font-mono font-semibold">Recent</div>
        {Array.isArray(deployments) && deployments.length > 0 ? (
          <table className="w-full text-xs font-mono">
            <thead><tr className="border-b border-slate-800">
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Service</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Env</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Status</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Time</th>
            </tr></thead>
            <tbody>
              {deployments.filter(d => d.environment !== 'production' || d.status === 'running').map((d, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-300">{d.service?.name ?? d.serviceId ?? '—'}</td>
                  <td className="px-4 py-2"><Badge color="cyan">{d.environment ?? '—'}</Badge></td>
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
      setHcl('# Error generating HCL. Ensure API is running and service exists.');
    } finally { setGenerating(false); }
  };

  const copy = () => { navigator.clipboard.writeText(hcl); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([hcl], { type: 'text/plain' }));
    a.download = 'main.tf'; a.click();
  };

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="Terraform HCL Viewer" sub="Read-only · view and download infrastructure-as-code for your services" />
      <InfoBanner>Read-only access · infrastructure changes require Team Lead approval</InfoBanner>

      <div className="flex gap-3">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="flex-1 bg-[#0d1424] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
          <option value="">Select service…</option>
          {Array.isArray(services) && services.map((s, i) => <option key={i} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={generate} disabled={!selectedId || generating} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-mono rounded-lg transition-colors">
          {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5" />}
          {generating ? 'Generating…' : 'View HCL'}
        </button>
      </div>

      {hcl && (
        <div className="bg-[#060a12] border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-400 text-xs font-mono font-semibold flex-1">main.tf (read-only)</span>
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

  useEffect(() => {
    fetch(`${API}/ai-advisory`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setItems(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="AI Advisory" sub="Pending recommendations for your services" />
      <InfoBanner>Approval requires action from Team Lead (Deepak)</InfoBanner>
      {Array.isArray(items) && items.length > 0 ? items.map((item, i) => (
        <div key={i} className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-slate-200 text-sm font-mono font-semibold">{item.service?.name ?? 'Service'}</span>
            <Badge color={item.status === 'pending' ? 'yellow' : item.status === 'approved' ? 'green' : 'red'}>{item.status ?? 'pending'}</Badge>
          </div>
          <p className="text-slate-400 text-xs font-mono">{item.recommendation ?? item.summary ?? 'AI-generated recommendation'}</p>
          {item.status === 'pending' && (
            <div className="flex items-center gap-2 text-slate-600 text-xs font-mono">
              <Lock className="w-3 h-3" />
              <span>Pending Lead Approval · contact Deepak</span>
            </div>
          )}
        </div>
      )) : (
        <div className="bg-[#0d1424] border border-slate-800 rounded-lg px-4 py-8 text-slate-700 text-xs font-mono text-center">No AI advisory items</div>
      )}
    </div>
  );
}

// ─── MY AUDIT TRAIL ───────────────────────────────────────────────────────────
function MyAudit({ token }: { token: string }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/audit`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const all = d.data ?? d;
        // Filter to current user's actions
        const mine = Array.isArray(all) ? all.filter((l: ApiRecord) => l.userId === user?.id || (l.user as ApiRecord)?.id === user?.id) : [];
        setLogs(mine.length > 0 ? mine : all);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, user?.id]);

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="My Audit Trail" sub="Your actions on the platform" />
      <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden">
        {Array.isArray(logs) && logs.length > 0 ? (
          <table className="w-full text-xs font-mono">
            <thead><tr className="border-b border-slate-800">
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Time</th>
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Action</th>
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Resource</th>
            </tr></thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2"><Badge color="blue">{l.action ?? '—'}</Badge></td>
                  <td className="px-4 py-2 text-slate-500 truncate max-w-[200px]">{l.resource ?? l.resourceId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-8 text-slate-700 text-xs font-mono text-center">No audit entries yet</div>
        )}
      </div>
    </div>
  );
}

// ─── DEVELOPER DASHBOARD ──────────────────────────────────────────────────────
export default function DeveloperDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('services');

  const renderContent = () => {
    if (!token) return null;
    switch (activeTab) {
      case 'services':    return <MyServices token={token} />;
      case 'scaffold':    return <ScaffoldService token={token} />;
      case 'deployments': return <Deployments token={token} />;
      case 'terraform':   return <TerraformHCL token={token} />;
      case 'ai':          return <AIAdvisory token={token} />;
      case 'audit':       return <MyAudit token={token} />;
      default:            return <MyServices token={token} />;
    }
  };

  return (
    <DashboardLayout
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerRight={
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono">
          <Server className="w-3.5 h-3.5" />
          <span>Developer</span>
          <ChevronRight className="w-3 h-3 text-slate-700" />
          <span className="text-slate-500">dev · staging</span>
        </div>
      }
    >
      {renderContent()}
    </DashboardLayout>
  );
}
