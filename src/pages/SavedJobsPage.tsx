import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SavedJob, JobAlert } from '../types';
import {
  getSavedJobs,
  toggleSaveJob,
  getJobAlerts,
  createJobAlert,
  deleteJobAlert
} from '../lib/api';
import {
  Bookmark,
  Bell,
  Trash2,
  Plus,
  ArrowRight,
  Briefcase,
  Clock,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';

interface SavedJobsPageProps {
  onSelectJob: (jobId: string) => void;
  onApplyJob: (jobId: string) => void;
  onOpenAuth: () => void;
}

export const SavedJobsPage: React.FC<SavedJobsPageProps> = ({
  onSelectJob,
  onApplyJob,
  onOpenAuth
}) => {
  const { user } = useAuth();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // New Alert form state
  const [newTitle, setNewTitle] = useState('');
  const [newDept, setNewDept] = useState('Engineering');
  const [newFrequency, setNewFrequency] = useState<'daily' | 'weekly'>('daily');
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadData = () => {
    if (!user) return;
    setLoading(true);
    const saved = getSavedJobs(user.id);
    const userAlerts = getJobAlerts(user.id);
    setSavedJobs(saved);
    setAlerts(userAlerts);
    setLoading(false);
  };

  const handleUnsave = (job: any) => {
    if (!user) return;
    toggleSaveJob(user.id, job);
    loadData();
  };

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;

    createJobAlert(user.id, {
      title: newTitle.trim(),
      department: newDept,
      frequency: newFrequency,
      is_active: true
    });

    setAlertNotice(
      `Job alert for "${newTitle}" created. (Note: Real-time automated email delivery depends on Supabase Auth SMTP configuration; alert is actively registered in your candidate profile).`
    );
    setTimeout(() => setAlertNotice(null), 6000);

    setNewTitle('');
    loadData();
  };

  const handleDeleteAlert = (alertId: string) => {
    deleteJobAlert(alertId);
    loadData();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
          <Bookmark className="w-12 h-12 text-[#085587] mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Sign In to Save Jobs & Alerts</h2>
          <p className="text-xs text-slate-500">
            Sign in to bookmark career opportunities, configure search alerts, and receive notifications when new roles open.
          </p>
          <button
            onClick={onOpenAuth}
            className="w-full py-2.5 bg-[#085587] text-white text-xs font-semibold rounded-lg hover:bg-[#074771]"
          >
            Sign In / Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
            Opportunities
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Saved Roles & Job Alerts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Bookmarked career opportunities and customized candidate alerts.
          </p>
        </div>

        {alertNotice && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-[#085587] shrink-0 mt-0.5" />
            <span>{alertNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main 2-span: Saved Jobs list */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#085587]" />
              Bookmarked Opportunities ({savedJobs.length})
            </h2>

            {savedJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                You haven't bookmarked any jobs yet. Browse open roles and click the bookmark icon to save them for later.
              </div>
            ) : (
              <div className="space-y-3">
                {savedJobs.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span className="text-[#085587] font-semibold">{item.job.department}</span>
                        <span>·</span>
                        <span>{item.job.location}</span>
                        <span>·</span>
                        <span>{item.job.workplace_type}</span>
                      </div>
                      <h3
                        onClick={() => onSelectJob(item.job_id)}
                        className="text-base font-bold text-slate-900 hover:text-[#085587] cursor-pointer"
                      >
                        {item.job.title}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Saved on {new Date(item.saved_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleUnsave(item.job)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50"
                        title="Remove bookmark"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onApplyJob(item.job_id)}
                        className="py-1.5 px-4 bg-[#085587] hover:bg-[#074771] text-white text-xs font-semibold rounded-lg shadow-xs"
                      >
                        Apply Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Col: Candidate-defined Job Alerts */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                Candidate Job Alerts
              </h2>
              <p className="text-xs text-slate-500">
                Receive notifications when new positions matching your keywords are published.
              </p>

              {/* Add Alert Form */}
              <form onSubmit={handleCreateAlert} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alert Keyword or Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Backend Engineer, React, DevOps"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product & Design">Product & Design</option>
                    <option value="Data & AI">Data & AI</option>
                    <option value="HR & People Ops">HR & People Ops</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dispatch Frequency
                  </label>
                  <div className="flex gap-4 text-xs">
                    <label className="flex items-center gap-1.5 text-slate-700">
                      <input
                        type="radio"
                        checked={newFrequency === 'daily'}
                        onChange={() => setNewFrequency('daily')}
                        className="text-[#085587]"
                      />
                      Daily
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-700">
                      <input
                        type="radio"
                        checked={newFrequency === 'weekly'}
                        onChange={() => setNewFrequency('weekly')}
                        className="text-[#085587]"
                      />
                      Weekly Digest
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Search Alert
                </button>
              </form>

              {/* Active Alerts List */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-800">Active Alert Subscriptions:</p>
                {alerts.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No active alerts configured.</p>
                ) : (
                  alerts.map((al) => (
                    <div
                      key={al.id}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{al.title}</p>
                        <p className="text-[10px] text-slate-500">
                          {al.department} · {al.frequency}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteAlert(al.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
