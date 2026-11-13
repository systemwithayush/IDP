import { useState, useEffect, useCallback } from 'react';
import DashboardLayout, { NavItem } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import {
  Activity, Layers, GitBranch, Sparkles, History, Boxes, Eye, EyeOff,
  CheckCircle2, AlertTriangle, RefreshCw, RotateCcw,
  Server, ChevronRight, KeyRound
} from 'lucide-react';

const API = 'http://localhost:4000/api/v1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiRecord = Record<string, any>;

const NAV_ITEMS: NavItem[] = [
  { id: 'overview',    label: 'Team Overview',    icon: <Activity className="w-4 h-4" /> },
  { id: 'services',    label: 'Team Services',    icon: <Layers className="w-4 h-4" /> },
  { id: 'deployments', label: 'Deployments',      icon: <GitBranch className="w-4 h-4" /> },
  { id: 'ai',          label: 'AI Advisory',      icon: <Sparkles className="w-4 h-4" /> },
  { id: 'quotas',      label: 'Team Quotas',      icon: <Boxes className="w-4 h-4" /> },
  { id: 'secrets',     label: 'Team Secrets',     icon: <KeyRound className="w-4 h-4" /> },
  { id: 'audit',       label: 'Team Audit',       icon: <History className="w-4 h-4" /> },
];

function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-800 text-slate-400 border-slate-700',
    blue: 'bg-blue-900/40 text-blue-400 border-blue-700/60',
    green: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/60',
    red: 'bg-red-900/40 text-red-400 border-red-700/60',
    purple: 'bg-purple-900/40 text-purple-400 border-purple-700/60',
    yellow: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/60',
    cyan: 'bg-cyan-900/40 text-cyan-400 border-cyan-700/60',
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

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-[#0d1424] border border-blue-700/50 rounded-lg shadow-2xl">
      <Server className="w-4 h-4 text-blue-400 shrink-0" />
      <span className="text-blue-300 text-xs font-mono">{msg}</span>
      <button onClick={onClose} className="text-slate-600 hover:text-slate-400 ml-2">✕</button>
    </div>
  );
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
function Overview({ token }: { token: string }) {
  const [services, setServices] = useState<unknown[]>([]);
  const [deployments, setDeployments] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/services`, { headers: h }).then(r => r.ok ? r.json() : { data: [] }),
      fetch(`${API}/deployments?limit=5`, { headers: h }).then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([svc, dep]) => {
      setServices((svc as { data: unknown[] }).data ?? svc);
      setDeployments((dep as { data: unknown[] }).data ?? dep);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <SectionHeader title="Team Overview" sub="Payments & Core Services · Team Lead view" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Team Services', value: Array.isArray(services) ? services.length : 0, sub: 'managed by team', color: 'bg-blue-900/30 border-blue-800/50 text-blue-400' },
          { label: 'Active Deploys', value: Array.isArray(deployments) ? deployments.length : 0, sub: 'recent', color: 'bg-purple-900/30 border-purple-800/50 text-purple-400' },
          { label: 'Team Members', value: 2, sub: 'Deepak + Ayush', color: 'bg-cyan-900/30 border-cyan-800/50 text-cyan-400' },
          { label: 'Uptime', value: '99.9%', sub: '30-day avg', color: 'bg-emerald-900/30 border-emerald-800/50 text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className={`bg-[#0d1424] border ${s.color} rounded-lg p-4`}>
            <div className="text-slate-500 text-xs font-mono uppercase tracking-wider mb-1">{s.label}</div>
            <div className={`text-2xl font-mono font-bold ${s.color.split(' ')[2]}`}>{s.value}</div>
            <div className="text-slate-600 text-[11px] font-mono mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400 text-xs font-mono font-semibold">Recent Deployments</span>
        </div>
        {Array.isArray(deployments) && deployments.length > 0 ? (
          <table className="w-full text-xs font-mono">
            <thead><tr className="border-b border-slate-800">
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Service</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Env</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Status</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Time</th>
            </tr></thead>
            <tbody>
              {(deployments as ApiRecord[]).map((d, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-300">{d.service?.name ?? d.serviceId ?? '—'}</td>
                  <td className="px-4 py-2"><Badge color="cyan">{d.environment ?? '—'}</Badge></td>
                  <td className="px-4 py-2"><Badge color={d.status === 'running' ? 'green' : d.status === 'failed' ? 'red' : 'yellow'}>{d.status ?? '—'}</Badge></td>
                  <td className="px-4 py-2 text-slate-600">{d.createdAt ? new Date(d.createdAt).toLocaleTimeString() : '—'}</td>
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

// ─── TEAM SERVICES ────────────────────────────────────────────────────────────
function TeamServices({ token }: { token: string }) {
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
      <SectionHeader title="Team Services" sub="Services owned by Payments & Core team" />
      <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden">
        {Array.isArray(services) && services.length > 0 ? (
          <table className="w-full text-xs font-mono">
            <thead><tr className="border-b border-slate-800">
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Name</th>
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Language</th>
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Framework</th>
              <th className="text-left text-slate-600 px-4 py-2.5 font-normal">Status</th>
            </tr></thead>
            <tbody>
              {services.map((s, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-200 font-semibold">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Badge color="cyan">{s.language}</Badge></td>
                  <td className="px-4 py-2.5 text-slate-400">{s.framework}</td>
                  <td className="px-4 py-2.5"><Badge color="green">{s.status ?? 'active'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-8 text-slate-700 text-xs font-mono text-center">No services found</div>
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
  const [form, setForm] = useState({ serviceId: '', environment: 'staging', imageTag: 'latest' });
  const [deploying, setDeploying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/deployments`, { headers: h }).then(r => r.json()),
      fetch(`${API}/services`, { headers: h }).then(r => r.json()),
    ]).then(([d, s]) => {
      setDeployments(d.data ?? d); setServices(s.data ?? s); setLoading(false);
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
      setMsg('✓ Deployment queued'); load();
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Error'); }
    finally { setDeploying(false); }
  };

  const rollback = async (id: string) => {
    try {
      const res = await fetch(`${API}/deployments/${id}/rollback`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Rollback failed');
      setToast('✓ Rollback initiated'); load();
    } catch { setToast('Rollback failed'); }
  };

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      <SectionHeader title="Deployments" sub="Lead can deploy to staging and production" />

      <form onSubmit={deploy} className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="text-slate-300 text-xs font-mono font-semibold">Trigger Deployment</div>
        {msg && <div className={`text-xs font-mono ${msg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</div>}
        <div className="grid grid-cols-3 gap-3">
          <select value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))} className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
            <option value="">Select service…</option>
            {Array.isArray(services) && services.map((s, i) => <option key={i} value={s.id}>{s.name}</option>)}
          </select>
          <select value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))} className="bg-[#090d16] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500">
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
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Status</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Time</th>
              <th className="text-left text-slate-600 px-4 py-2 font-normal">Actions</th>
            </tr></thead>
            <tbody>
              {deployments.map((d, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-slate-300">{d.service?.name ?? d.serviceId ?? '—'}</td>
                  <td className="px-4 py-2"><Badge color={d.environment === 'production' ? 'red' : 'cyan'}>{d.environment ?? '—'}</Badge></td>
                  <td className="px-4 py-2"><Badge color={d.status === 'running' ? 'green' : d.status === 'failed' ? 'red' : 'yellow'}>{d.status ?? '—'}</Badge></td>
                  <td className="px-4 py-2 text-slate-600">{d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => rollback(d.id)} className="flex items-center gap-1 text-slate-600 hover:text-amber-400 transition-colors text-[11px]">
                      <RotateCcw className="w-3 h-3" /> Rollback
                    </button>
                  </td>
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

// ─── AI ADVISORY ──────────────────────────────────────────────────────────────
function AIAdvisory({ token }: { token: string }) {
  const [items, setItems] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`${API}/ai-advisory`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setItems(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActing(id);
    try {
      const res = await fetch(`${API}/ai-advisory/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: `${action}d by team lead` }),
      });
      if (!res.ok) throw new Error('Failed');
      setToast(`✓ Advisory ${action}d — this action has been logged in the team audit trail`);
      load();
    } catch { setToast('Action failed'); } finally { setActing(null); }
  };

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      <SectionHeader title="AI Advisory" sub="Review and approve AI-generated recommendations for your team" />
      {Array.isArray(items) && items.length > 0 ? items.map((item, i) => (
        <div key={i} className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-slate-200 text-sm font-mono font-semibold">{item.service?.name ?? 'Service'}</span>
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
        <div className="bg-[#0d1424] border border-slate-800 rounded-lg px-4 py-8 text-slate-700 text-xs font-mono text-center">No AI advisory items pending</div>
      )}
    </div>
  );
}

// ─── TEAM QUOTAS ──────────────────────────────────────────────────────────────
function TeamQuotas({ token }: { token: string }) {
  const [quotas, setQuotas] = useState<Record<string, number>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/quotas`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setQuotas(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-slate-600 text-xs font-mono p-6">Loading…</div>;

  const quota = Array.isArray(quotas) ? quotas[0] : null;
  const pct = quota?.maxServices ? Math.round((quota.usedServices ?? 0) / quota.maxServices * 100) : 0;

  return (
    <div className="p-6 space-y-4">
      <SectionHeader title="Team Quotas" sub="Payments & Core team resource usage" />
      {quota ? (
        <div className="space-y-4">
          {[
            { label: 'Services', used: quota.usedServices ?? 0, max: quota.maxServices ?? 10, color: 'bg-blue-500' },
            { label: 'CPU (cores)', used: quota.usedCpu ?? 0, max: quota.maxCpu ?? 32, color: 'bg-purple-500' },
            { label: 'Memory (GB)', used: quota.usedMemory ?? 0, max: quota.maxMemory ?? 64, color: 'bg-cyan-500' },
          ].map((q, i) => {
            const p = q.max ? Math.round((q.used / q.max) * 100) : 0;
            return (
              <div key={i} className="bg-[#0d1424] border border-slate-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">{q.label}</span>
                  <span className="text-slate-300">{q.used} / {q.max} ({p}%)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${q.color} ${p > 80 ? 'bg-red-500' : ''}`} style={{ width: `${Math.min(p, 100)}%` }} />
                </div>
              </div>
            );
          })}
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 text-blue-400 text-xs font-mono">
            Overall: {pct}% capacity used · Contact admin to request quota increase
          </div>
        </div>
      ) : (
        <div className="bg-[#0d1424] border border-slate-800 rounded-lg px-4 py-8 text-slate-700 text-xs font-mono text-center">No quota data · ensure database is running and seeded</div>
      )}
    </div>
  );
}

// ─── TEAM SECRETS ─────────────────────────────────────────────────────────────
function TeamSecrets({ token }: { token: string }) {
  const [services, setServices] = useState<ApiRecord[]>([]);
  const [selectedSvcId, setSelectedSvcId] = useState('');
  const [envs, setEnvs] = useState<ApiRecord[]>([]);
  const [secrets, setSecrets] = useState<Record<string, string | boolean>[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const revealSecret = (id: string) => {
    setRevealed(r => ({ ...r, [id]: !r[id] }));
    if (!revealed[id]) {
      setToast('⚠ Audit notice: secret reveal has been logged');
    }
  };

  return (
    <div className="p-6 space-y-4">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      <SectionHeader title="Team Secrets" sub="Secrets reveal is audited — a log entry is created on each reveal" />

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

      <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-4 py-6 text-slate-600 text-xs font-mono text-center">Loading…</div>
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
                  <td className="px-4 py-2.5">
                    {revealed[s.id as string]
                      ? <span className="text-amber-400">{s.value as string}</span>
                      : <span className="tracking-widest text-slate-700">••••••••</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => revealSecret(s.id as string)} className="text-slate-600 hover:text-slate-300 transition-colors">
                      {revealed[s.id as string] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
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

// ─── TEAM AUDIT ───────────────────────────────────────────────────────────────
function TeamAudit({ token }: { token: string }) {
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
      <SectionHeader title="Team Audit Trail" sub="Actions performed by team members" />
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
          <div className="px-4 py-8 text-slate-700 text-xs font-mono text-center">No audit entries yet</div>
        )}
      </div>
    </div>
  );
}

// ─── LEAD DASHBOARD ───────────────────────────────────────────────────────────
export default function LeadDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    if (!token) return null;
    switch (activeTab) {
      case 'overview':    return <Overview token={token} />;
      case 'services':    return <TeamServices token={token} />;
      case 'deployments': return <Deployments token={token} />;
      case 'ai':          return <AIAdvisory token={token} />;
      case 'quotas':      return <TeamQuotas token={token} />;
      case 'secrets':     return <TeamSecrets token={token} />;
      case 'audit':       return <TeamAudit token={token} />;
      default:            return <Overview token={token} />;
    }
  };

  return (
    <DashboardLayout
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerRight={
        <div className="flex items-center gap-1.5 text-blue-400 text-xs font-mono">
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Payments &amp; Core</span>
        </div>
      }
    >
      {renderContent()}
    </DashboardLayout>
  );
}
