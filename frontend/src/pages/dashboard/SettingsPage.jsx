import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import {
  User,
  Shield,
  Bot,
  Sliders,
  Lock,
  Key,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
  Save,
  Check,
  AlertTriangle,
  Info
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile'); // profile, security, chatbots, preferences

  // Profile Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Connected Chatbots State
  const [chatbots, setChatbots] = useState([]);
  const [loadingChatbots, setLoadingChatbots] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'chatbots') {
      fetchChatbots();
    }
  }, [activeTab]);

  const fetchChatbots = async () => {
    try {
      setLoadingChatbots(true);
      const res = await api.get('/chatbots/');
      setChatbots(res.data);
    } catch (err) {
      console.error('Failed to load chatbots:', err);
    } finally {
      setLoadingChatbots(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
    try {
      setSavingProfile(true);
      await api.put('/auth/profile', { full_name: fullName.trim() });
      setProfileSuccess('Profile name updated successfully.');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setProfileError(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setChangingPassword(true);
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err) {
      setPasswordError(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteChatbot = async (chatbotId) => {
    try {
      setDeletingId(chatbotId);
      await api.delete(`/chatbots/${chatbotId}`);
      setChatbots((prev) => prev.filter((b) => b.id !== chatbotId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete chatbot:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security & Password', icon: Shield },
    { id: 'chatbots', label: 'Connected Chatbots', icon: Bot },
    { id: 'preferences', label: 'Application Preferences', icon: Sliders },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings & Preferences</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage your account profile, credentials, connected chatbots, and platform security.
        </p>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-surface-border overflow-x-auto space-x-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-brand-yellow text-brand-yellow'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-6 max-w-2xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-white">Account Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">Personal details associated with your VeriFA AI account.</p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-surface-darkest border border-surface-border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-yellow"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-surface-darkest/60 border border-surface-border rounded-lg px-3 py-2 text-slate-500 font-mono cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Email address is locked as your primary tenant identifier.
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">User ID</label>
              <input
                type="text"
                value={user?.id || ''}
                disabled
                className="w-full bg-surface-darkest/60 border border-surface-border rounded-lg px-3 py-2 text-slate-500 font-mono text-[11px] cursor-not-allowed"
              />
            </div>

            {profileSuccess && (
              <div className="p-3 rounded-lg bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-yellow text-black font-bold hover:bg-yellow-400 transition-all shadow-glow-yellow disabled:opacity-50"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Changes</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-6 max-w-2xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-white">Password & Security</h2>
            <p className="text-xs text-slate-400 mt-0.5">Update your password to keep your evaluation datasets secure.</p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full bg-surface-darkest border border-surface-border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-yellow"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">New Password (Min. 6 chars)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-surface-darkest border border-surface-border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-yellow"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-surface-darkest border border-surface-border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-brand-yellow"
              />
            </div>

            {passwordSuccess && (
              <div className="p-3 rounded-lg bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={changingPassword}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-yellow text-black font-bold hover:bg-yellow-400 transition-all shadow-glow-yellow disabled:opacity-50"
            >
              {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>Update Password</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Connected Chatbots */}
      {activeTab === 'chatbots' && (
        <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white">Connected Chatbot Endpoints</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage registered endpoints. Removing a connection permanently shreds encrypted API credentials.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {chatbots.length} Active Connections
            </span>
          </div>

          {loadingChatbots ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand-yellow" />
              <span>Loading connections...</span>
            </div>
          ) : chatbots.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-surface-border rounded-xl text-slate-500 text-xs">
              No chatbots currently connected. Register an endpoint in Chatbot Connections tab.
            </div>
          ) : (
            <div className="border border-surface-border rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-darkest/70 border-b border-surface-border text-slate-400 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="py-3 px-4">Chatbot Name</th>
                    <th className="py-3 px-4">Endpoint URL</th>
                    <th className="py-3 px-4">Masked Key</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border text-slate-300">
                  {chatbots.map((bot) => (
                    <tr key={bot.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{bot.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px] truncate max-w-[200px]" title={bot.api_endpoint}>
                        {bot.api_endpoint}
                      </td>
                      <td className="py-3 px-4 font-mono text-brand-yellow text-[11px]">
                        {bot.masked_api_key || 'No key'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] uppercase font-bold text-slate-400">
                        {bot.http_method}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {deleteConfirmId === bot.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleDeleteChatbot(bot.id)}
                              disabled={deletingId === bot.id}
                              className="px-2 py-1 rounded bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 transition-colors"
                            >
                              {deletingId === bot.id ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 rounded border border-surface-border text-slate-400 hover:text-white text-[10px]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(bot.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Remove Chatbot Connection"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Application Preferences */}
      {activeTab === 'preferences' && (
        <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-6 max-w-3xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-white">Application Preferences & Security Protocol</h2>
            <p className="text-xs text-slate-400 mt-0.5">System runtime parameters, active models, and security guarantees.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-surface-border bg-surface-darkest space-y-2">
              <div className="flex items-center gap-2 text-brand-yellow font-bold">
                <Bot className="w-4 h-4" />
                <span>Primary Evaluator Engine</span>
              </div>
              <p className="text-slate-300 font-mono text-[11px]">
                vectara/hallucination_evaluation_model
              </p>
              <p className="text-[11px] text-slate-500">
                Preloaded singleton cross-encoder running native PyTorch inference in memory with zero per-request reload latency.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-surface-border bg-surface-darkest space-y-2">
              <div className="flex items-center gap-2 text-brand-emerald font-bold">
                <Shield className="w-4 h-4" />
                <span>Zero Key Logging Protocol</span>
              </div>
              <p className="text-slate-300 font-mono text-[11px]">
                AES-256 Fernet Encrypted At Rest
              </p>
              <p className="text-[11px] text-slate-500">
                External API keys are decrypted exclusively in memory immediately prior to outbound calls and masked as sk-...cdef.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-surface-border bg-surface-darkest space-y-2">
              <div className="flex items-center gap-2 text-brand-cyan font-bold">
                <Lock className="w-4 h-4" />
                <span>SSRF Outbound Guard</span>
              </div>
              <p className="text-slate-300 font-mono text-[11px]">
                RFC 1918 & Cloud Metadata Filter
              </p>
              <p className="text-[11px] text-slate-500">
                Loopback, 127.0.0.1, private LAN subnets, and cloud metadata (169.254.169.254) are strictly blocked from outbound requests.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-surface-border bg-surface-darkest space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <Key className="w-4 h-4" />
                <span>Authentication Protocol</span>
              </div>
              <p className="text-slate-300 font-mono text-[11px]">
                Stateless JWT · HS256 Signed
              </p>
              <p className="text-[11px] text-slate-500">
                Tenant isolation enforced across all database queries, evaluation history, and analytics aggregations.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
