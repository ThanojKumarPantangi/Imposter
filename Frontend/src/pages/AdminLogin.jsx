import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AdminLogin() {
  const navigate = useNavigate();
  const { adminLogin, isAdminAuthenticated } = useAuth();
  const [email, setEmail] = useState('admin@imposter.game');
  const [password, setPassword] = useState('AdminSecret123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already authenticated, redirect to dashboard
  if (isAdminAuthenticated) {
    navigate('/admin/dashboard');
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await adminLogin(email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid administrative credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Game</span>
        </button>
      </div>

      <div className="glass-card p-8 border-rose-500/20 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
          <ShieldCheck className="w-7 h-7" />
        </div>

        <h1 className="font-display font-black text-2xl text-center text-white mb-1">
          Admin Portal
        </h1>
        <p className="text-xs text-slate-400 text-center mb-6">
          Authorized personnel only. Manage word packs, categories, and database seeding.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-dark-950 border border-slate-700 focus:border-rose-500 pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-dark-950 border border-slate-700 focus:border-rose-500 pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2 mt-2"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In as Admin'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
