import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Terminal, ShieldCheck, Zap, AlertCircle, Eye, EyeOff, Cpu } from 'lucide-react';

interface PersonaCard {
  name: string;
  email: string;
  role: 'admin' | 'lead' | 'developer';
  description: string;
  badge: string;
  badgeColor: string;
  avatar: string;
  avatarBg: string;
}

const PERSONAS: PersonaCard[] = [
  {
    name: 'Divya',
    email: 'divya@idp.internal',
    role: 'admin',
    description: 'Platform Admin · Full org access, secrets vault, user management',
    badge: 'ADMIN',
    badgeColor: 'text-purple-400 bg-purple-900/40 border-purple-700/60',
    avatar: 'DV',
    avatarBg: 'bg-gradient-to-br from-purple-600 to-indigo-700',
  },
  {
    name: 'Deepak',
    email: 'deepak@idp.internal',
    role: 'lead',
    description: 'Team Lead · Payments & Core · Deploy to prod, approve AI advisory',
    badge: 'LEAD',
    badgeColor: 'text-blue-400 bg-blue-900/40 border-blue-700/60',
    avatar: 'DK',
    avatarBg: 'bg-gradient-to-br from-blue-600 to-cyan-700',
  },
  {
    name: 'Ayush',
    email: 'ayush@idp.internal',
    role: 'developer',
    description: 'Developer · Scaffold services, deploy dev/staging, view Terraform',
    badge: 'DEV',
    badgeColor: 'text-emerald-400 bg-emerald-900/40 border-emerald-700/60',
    avatar: 'AY',
    avatarBg: 'bg-gradient-to-br from-emerald-600 to-teal-700',
  },
];

export default function LoginPage() {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleQuickLogin = (persona: PersonaCard) => {
    setEmail(persona.email);
    setPassword('password123');
    setLocalError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Email and password are required');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      // error is in context
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
      {/* Glow blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-700/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-700/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-blue-400" />
          </div>
          <span className="text-white font-mono font-bold text-xl tracking-tight">IDP</span>
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-900/40 text-blue-400 border border-blue-700/50 rounded">
            INTERNAL
          </span>
        </div>
        <h1 className="text-slate-200 font-mono text-2xl font-semibold tracking-tight">
          Internal Developer Platform
        </h1>
        <p className="text-slate-500 text-sm font-mono mt-1">
          Sign in to access your workspace
        </p>
      </div>

      {/* Quick login personas */}
      <div className="relative z-10 w-full max-w-2xl mb-6">
        <p className="text-slate-600 text-xs font-mono uppercase tracking-widest mb-3 text-center">
          Quick access — click to pre-fill
        </p>
        <div className="grid grid-cols-3 gap-3">
          {PERSONAS.map((p) => (
            <button
              key={p.email}
              type="button"
              onClick={() => handleQuickLogin(p)}
              className={`flex flex-col gap-2 p-3 rounded-lg border bg-[#0d1424] border-slate-800 hover:border-slate-600 transition-all group text-left ${
                email === p.email ? 'border-blue-500/60 bg-blue-950/20' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-md ${p.avatarBg} flex items-center justify-center text-white text-xs font-bold font-mono`}>
                  {p.avatar}
                </div>
                <div className="min-w-0">
                  <div className="text-slate-200 text-sm font-mono font-semibold leading-none">{p.name}</div>
                  <span className={`inline-block mt-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${p.badgeColor}`}>
                    {p.badge}
                  </span>
                </div>
              </div>
              <p className="text-slate-500 text-[11px] font-mono leading-snug group-hover:text-slate-400 transition-colors">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Login form */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-6 shadow-2xl">
          {displayError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-900/30 border border-red-700/50 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-red-300 text-xs font-mono">{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-slate-500 text-xs font-mono uppercase tracking-widest block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@idp.internal"
                className="w-full bg-[#090d16] border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 font-mono text-sm placeholder-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-slate-500 text-xs font-mono uppercase tracking-widest block mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#090d16] border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-slate-200 font-mono text-sm placeholder-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-slate-700 text-[11px] font-mono mt-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                All accounts use <code className="text-slate-500">password123</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 disabled:text-blue-700 text-white font-mono font-semibold text-sm rounded-lg transition-colors"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <Terminal className="w-3 h-3 text-slate-700" />
          <span className="text-slate-700 text-[11px] font-mono">
            IDP v1.0 · Role-based access control active
          </span>
        </div>
      </div>
    </div>
  );
}

