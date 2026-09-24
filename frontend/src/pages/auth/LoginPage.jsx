import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { ShieldCheck, ArrowRight, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      login(res.data.access_token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Cannot connect to backend server. Please verify the FastAPI backend is running on http://127.0.0.1:8000.');
      } else {
        setError('Failed to authenticate. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-darkest flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-brand-yellow selection:text-black">
      {/* Background radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-brand-yellow/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Header Branding */}
      <div className="mb-8 text-center">
        <Link to="/" className="inline-flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-brand-yellow flex items-center justify-center font-black text-black text-xl tracking-wider shadow-glow-yellow group-hover:scale-105 transition-transform">
            V
          </div>
          <div className="flex flex-col text-left">
            <span className="font-extrabold tracking-tight text-white text-2xl">
              VeriFA <span className="text-brand-yellow">AI</span>
            </span>
            <span className="text-[10px] text-slate-400 -mt-1 tracking-widest font-mono">
              EVALUATION PLATFORM
            </span>
          </div>
        </Link>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Sign In</h1>
          <p className="text-xs text-slate-400 mt-1">
            Access your evaluation dashboard and chatbot connections.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@company.com"
                className="w-full bg-surface-darkest border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-surface-darkest border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-brand-yellow hover:bg-brand-gold disabled:opacity-50 text-black font-bold text-sm rounded-xl transition-all shadow-glow-yellow flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-surface-border/60 text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-yellow hover:underline font-semibold">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
