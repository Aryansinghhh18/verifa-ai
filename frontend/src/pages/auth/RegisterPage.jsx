import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { User, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/register', {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.data?.access_token) {
        login(res.data.access_token, res.data.user);
        navigate('/dashboard');
      } else {
        setError('Account created, but token was missing. Please log in.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      let errorMsg = 'Failed to create account. Please try again.';

      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        // FastAPI / Pydantic 422 validation errors
        errorMsg = detail.map((item) => item.msg || JSON.stringify(item)).join('. ');
      } else if (detail && typeof detail === 'object') {
        errorMsg = detail.msg || detail.message || JSON.stringify(detail);
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        errorMsg = 'Cannot connect to backend server. Please verify the FastAPI backend is running on http://127.0.0.1:8000.';
      } else if (err.response?.status === 500 || err.response?.status === 502 || err.response?.status === 504) {
        errorMsg = 'Backend server communication error. Please ensure the backend is running.';
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-darkest flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-brand-yellow selection:text-black">
      {/* Background radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-brand-cyan/10 blur-[130px] rounded-full pointer-events-none -z-10" />

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
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-xs text-slate-400 mt-1">
            Start testing and evaluating your chatbot endpoints today.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {typeof error === 'string' && error.includes('already exists') && (
                <div className="mt-1.5">
                  <Link to="/login" className="text-brand-yellow hover:underline font-semibold">
                    Sign in to your account &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full bg-surface-darkest border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-sans"
              />
            </div>
          </div>

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
                placeholder="user@example.com"
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
                placeholder="Minimum 6 characters"
                className="w-full bg-surface-darkest border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
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
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Register & Access Platform</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-surface-border/60 text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-brand-yellow hover:underline font-semibold">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
